// RAVIQEN Phase 3 — Advanced Threat Detection (True Anomaly Typologies)
// Runs AFTER contextual false-positive suppression. These are genuine fraud
// indicators that must ESCALATE regardless of vendor whitelist status:
//   1. Structuring / Smurfing  — rapid-fire sub-threshold invoices from one vendor
//   2. Velocity Attacks (ATO)  — high-frequency wallet drains in < 5 minutes
//   3. Sector Mismatch         — billing items contradict the vendor's registered nature
//   4. BEC / Shell Entities     — corporate invoice → personal wallet / mismatched beneficiary
//
// Each detector returns { flags: string[], details: string[], rules: {rule_id,severity}[] }.

const APPROVAL_THRESHOLD = { USD: 10000, NGN: 10000000, GBP: 8000, EUR: 9000 };
const SMURF_WINDOW_HOURS = 24;
const SMURF_MIN_COUNT = 3;
const SMURF_BAND = 0.8; // invoices within 80%-100% of the approval threshold

const VELOCITY_WINDOW_MINUTES = 5;
const VELOCITY_MIN_COUNT = 3;

// Sector keyword maps — vendor name → expected sector; item description → sector.
const VENDOR_SECTOR_KEYWORDS = [
  { sector: "education", keywords: ["school", "academy", "college", "university", "institute", "education", "lyceum", "seminary", "polytechnic"] },
  { sector: "healthcare", keywords: ["hospital", "clinic", "medical", "pharmacy", "health", "dental", "diagnostic", "lab"] },
  { sector: "hospitality", keywords: ["hotel", "resort", "restaurant", "catering", "lodge", "suite"] },
  { sector: "retail", keywords: ["mart", "store", "shop", "boutique", "retail", "supermarket"] },
];

const ITEM_SECTOR_KEYWORDS = [
  { sector: "heavy_construction", keywords: ["dredging", "dredger", "excavator", "bulldozer", "crane", "heavy machinery", "earthmoving", "civil works", "foundation piling", "marine logistics", "vessel", "barge", "tugboat"] },
  { sector: "military", keywords: ["ammunition", "firearm", "rifle", "ordnance", "weapon", "firearms", "tactical gear", "ballistic"] },
  { sector: "pharma", keywords: ["pharmaceutical", "narcotic", "controlled substance", "opioid", "narcotics"] },
];

function vendorSector(name) {
  const n = String(name || "").toLowerCase();
  for (const s of VENDOR_SECTOR_KEYWORDS) {
    if (s.keywords.some((k) => n.includes(k))) return s.sector;
  }
  return null;
}

function itemSector(desc) {
  const d = String(desc || "").toLowerCase();
  for (const s of ITEM_SECTOR_KEYWORDS) {
    if (s.keywords.some((k) => d.includes(k))) return s.sector;
  }
  return null;
}

function parseDate(v) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.getTime();
}

// ── 1. Structuring / Smurfing ───────────────────────────────────────────────
export function detectSmurfing(record, baseline = []) {
  const out = { flags: [], details: [], rules: [] };
  const vendor = String(record.vendor || "").toLowerCase();
  const currency = String(record.currency || "USD").toUpperCase();
  const threshold = APPROVAL_THRESHOLD[currency] || APPROVAL_THRESHOLD.USD;
  const amount = Number(record.amount) || 0;
  if (!vendor || amount <= 0) return out;

  // Only invoices sitting in the band just below the approval threshold count
  const inBand = amount >= threshold * SMURF_BAND && amount < threshold;
  if (!inBand) return out;

  const now = parseDate(record.transaction_date);
  if (now == null) return out;
  const windowStart = now - SMURF_WINDOW_HOURS * 3600 * 1000;
  const sameVendorNearThreshold = baseline.filter((t) => {
    if (!t.vendor || t.vendor.toLowerCase() !== vendor) return false;
    const a = Number(t.amount) || 0;
    if (a < threshold * SMURF_BAND || a >= threshold) return false;
    const ts = parseDate(t.transaction_date);
    return ts != null && ts >= windowStart && ts <= now + 3600 * 1000;
  });

  const count = sameVendorNearThreshold.length + 1; // include current
  if (count >= SMURF_MIN_COUNT) {
    out.flags.push("Structuring / Smurfing detected");
    out.details.push(`${count} invoices from "${record.vendor}" between ${Math.round(threshold * SMURF_BAND).toLocaleString()} and ${threshold.toLocaleString()} ${currency} within a ${SMURF_WINDOW_HOURS}h window — deliberate sub-threshold fragmentation to evade executive approval.`);
    out.rules.push({ rule_id: "THREAT-SMURF", severity: "critical" });
  }
  return out;
}

// ── 2. Velocity Attacks (ATO) ───────────────────────────────────────────────
export function detectVelocity(record, baseline = []) {
  const out = { flags: [], details: [], rules: [] };
  const vendor = String(record.vendor || "").toLowerCase();
  const ts = parseDate(record.transaction_date);
  if (!vendor || ts == null) return out;

  const windowStart = ts - VELOCITY_WINDOW_MINUTES * 60 * 1000;
  const windowEnd = ts + VELOCITY_WINDOW_MINUTES * 60 * 1000;
  const rapid = baseline.filter((t) => {
    if (!t.vendor || t.vendor.toLowerCase() !== vendor) return false;
    const o = parseDate(t.transaction_date);
    return o != null && o >= windowStart && o <= windowEnd;
  });

  const count = rapid.length + 1;
  if (count >= VELOCITY_MIN_COUNT) {
    out.flags.push("Velocity attack / ATO pattern");
    out.details.push(`${count} transactions from "${record.vendor}" within a ${VELOCITY_WINDOW_MINUTES}-minute window — high-frequency wallet-drain pattern consistent with account takeover.`);
    out.rules.push({ rule_id: "THREAT-VELOCITY", severity: "critical" });
  }
  return out;
}

// ── 3. Sector Mismatch ──────────────────────────────────────────────────────
export function detectSectorMismatch(record) {
  const out = { flags: [], details: [], rules: [] };
  const vSector = vendorSector(record.vendor);
  const iSector = itemSector(record.item_description || record.description || record.category);
  if (!vSector || !iSector) return out;

  // Heavy-construction items billed by a school/hospital/retail entity = mismatch
  const contradictionMap = {
    education: ["heavy_construction", "military", "pharma"],
    healthcare: ["heavy_construction", "military"],
    hospitality: ["heavy_construction", "military", "pharma"],
    retail: ["heavy_construction", "military"],
  };
  const contradictions = contradictionMap[vSector] || [];
  if (contradictions.includes(iSector)) {
    out.flags.push("Sector mismatch — items contradict vendor nature");
    out.details.push(`"${record.vendor}" appears to be a ${vSector} entity but is billing for ${iSector} goods/services — possible shell entity or misclassified spend.`);
    out.rules.push({ rule_id: "THREAT-SECTOR-MISMATCH", severity: "high" });
  }
  return out;
}

// ── 4. BEC / Shell Entities (personal wallet on corporate invoice) ───────────
const PERSONAL_WALLETS = ["opay", "palmpay", "moniepoint", "paga", "carbon", "fairmoney"];
export function detectBEC(record) {
  const out = { flags: [], details: [], rules: [] };
  const docType = String(record.document_type || record.category || "").toLowerCase();
  const isInvoice = docType.includes("invoice");
  if (!isInvoice) return out;

  const bankName = String(record.bank_name || "").toLowerCase().trim();
  const acctName = String(record.account_name || record.bank_account || "").trim();
  const org = String(record.organization || record.vendor || "").trim();
  const personalWallet = bankName && PERSONAL_WALLETS.includes(bankName);
  const mismatchedBeneficiary = !!(acctName && org && acctName.toLowerCase() !== org.toLowerCase() && !org.toLowerCase().includes(acctName.toLowerCase()) && !acctName.toLowerCase().includes(org.toLowerCase()));

  if (personalWallet) {
    out.flags.push("BEC indicator — corporate invoice routed to personal wallet");
    out.details.push(`Invoice directs payment to a personal mobile-money wallet (${record.bank_name}) instead of a corporate account — classic Business Email Compromise or shell-entity indicator.`);
    out.rules.push({ rule_id: "THREAT-BEC", severity: "critical" });
  } else if (mismatchedBeneficiary) {
    out.flags.push("BEC indicator — beneficiary name mismatch");
    out.details.push(`Invoice beneficiary "${acctName}" does not match the invoicing organization "${org}" — potential BEC / account-substitution attack.`);
    out.rules.push({ rule_id: "THREAT-BEC", severity: "high" });
  }
  return out;
}

// ── Combined advanced threat detection ──────────────────────────────────────
export function detectAdvancedThreats(record, baseline = []) {
  const merged = { flags: [], details: [], rules: [], evidence: [] };
  const sources = [
    [record.bank_name ? 'bank_name' : 'account_name', record.bank_name || record.account_name],
    ['amount', record.amount],
    ['transaction_date', record.transaction_date],
    [record.item_description ? 'item_description' : record.description ? 'description' : 'category', record.item_description || record.description || record.category],
  ];
  const detectors = [detectBEC(record), detectSmurfing(record, baseline), detectVelocity(record, baseline), detectSectorMismatch(record)];
  detectors.forEach((d, i) => {
    const [field, value] = sources[i];
    if (value == null || ['', 'unknown', 'n/a', 'not specified', 'not provided'].includes(String(value).trim().toLowerCase())) return;
    d.flags.forEach((flag, index) => merged.evidence.push({ flag, rule_id: d.rules[index]?.rule_id, evidence_field: field, evidence_value: String(value), detail: d.details[index] }));
    merged.flags.push(...d.flags);
    merged.details.push(...d.details);
    merged.rules.push(...d.rules);
  });
  return merged;
}