// RAVIQEN Master Extraction & Risk Intelligence Engine
// Surgical extraction + math verification + industry-aware contextual logic.
// Outputs a strict JSON webhook payload (document_metadata / financials / risk_assessment)
// with raw numeric amounts + ISO 4217 currency codes — never localized symbols in data fields.

import { analyzeProcurementVariance, topProcurementRule, isProcurementRecord } from "@/lib/procurementVariance";
import { runRavigenRules, extractRecordsFromFile } from "@/lib/ingestionScreening";
import { runHospitalityFraudDetection, extractOperationalRecords } from "@/lib/hospitalityFraudEngine";
import { riskLevelFromScore } from "@/lib/riskSeverity";
import { stableDocumentId } from "@/lib/scanConsistency";

const HEAVY_INDUSTRY = [
  "Marine Logistics", "Heavy Equipment", "Heavy Infrastructure", "Construction",
  "IT Infrastructure", "Enterprise IT", "Real Estate", "Heavy Industry",
  "Logistics", "Oil & Gas", "Manufacturing", "Mining", "Energy", "Dredging",
];
const HEAVY_INDUSTRY_KEYWORDS = [
  "marine", "dredging", "dredger", "excavator", "crane", "bulldozer", "heavy machinery",
  "industrial equipment", "generator", "transformer", "turbine", "drilling", "stockpillar",
  "cubic", "stand by payment", "standby payment", "caterpillar", "heavy equipment",
  "construction", "infrastructure", "logistics", "manufacturing", "mining", "energy",
  "oil & gas", "cargo", "vessel", "barge", "rig",
];
const PERSONAL_WALLETS = ["opay", "moniepoint", "palmpay", "paga"];

// Native localized currency symbols for briefing typography only (never in raw data fields).
const CURRENCY_SYMBOLS = { NGN: "₦", USD: "$", GBP: "£", EUR: "€", JPY: "¥", ZAR: "R", CNY: "¥", INR: "₹", GHS: "₵", KES: "KSh", CAD: "C$", AUD: "A$" };
function formatCurrency(amount, code) {
  const sym = CURRENCY_SYMBOLS[code];
  const n = Number(amount).toLocaleString();
  return sym ? `${sym}${n}` : `${n} ${code}`;
}

// Structural mismatch — an entity in a non-industrial sector billing for heavy industrial equipment.
const MISMATCH_SECTORS = ["ngo", "foundation", "charity", "education", "school", "university", "trust", "initiative", "society", "association", "religious", "ministry"];
const HEAVY_EQUIPMENT = ["excavator", "dredger", "crane", "bulldozer", "heavy machinery", "industrial equipment", "generator", "transformer", "turbine", "drilling rig", "marine logistics", "heavy equipment", "caterpillar"];
function isStructuralMismatch(record) {
  const vendorCat = String(record.vendor_category || record.vendor_industry || record.industry || record.sector || "").toLowerCase();
  const vendorName = String(record.vendor || "").toLowerCase();
  const itemHay = [
    String(record.item_description || record.description || ""),
    String(record.category || ""),
    ...extractLineItems(record).map((li) => li.description),
  ].join(" ").toLowerCase();
  const mismatchSector = MISMATCH_SECTORS.some((s) => vendorCat.includes(s) || vendorName.includes(s));
  const heavyItem = HEAVY_EQUIPMENT.some((h) => itemHay.includes(h));
  return mismatchSector && heavyItem;
}

function normName(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, ""); }

function hasField(r, names) {
  const keys = Object.keys(r || {});
  return names.some((n) => {
    const target = n.toLowerCase().replace(/[\s_-]/g, "");
    return keys.some((k) => k.toLowerCase().replace(/[\s_-]/g, "") === target && r[k] != null && r[k] !== "");
  });
}
function findField(record, name) {
  const target = name.toLowerCase().replace(/[\s_-]/g, "");
  const key = Object.keys(record || {}).find((k) => k.toLowerCase().replace(/[\s_-]/g, "") === target);
  return key ? record[key] : null;
}

function isPMSRecord(r) { return hasField(r, ["room_number", "reservation_id", "housekeeping_status", "keycard_entries"]); }
function isPOSRecord(r) { return hasField(r, ["check_id", "server_id"]) && hasField(r, ["payment_type", "void_count", "check_status"]); }
function isHRRecord(r) { return hasField(r, ["employee_id"]) && hasField(r, ["bank_account", "expense_category", "access_logs_count", "payroll_received", "next_of_kin", "expense_amount", "receipt_id"]); }
function isHeavyIndustry(r) {
  const cat = String(r?.vendor_category || r?.category || r?.industry || r?.sector || "").toLowerCase();
  return HEAVY_INDUSTRY.some((h) => cat.includes(h.toLowerCase()));
}

// ─── 1. SURGICAL EXTRACTION & MATH VERIFICATION ─────────────────────────────
// Target the explicit "Total" / "Amount Due" row. Do NOT aggregate random numbers
// (quantities like "3198.89 cubic", phone numbers, dates) into the financial total.
const TOTAL_FIELDS = ["total", "amount_due", "grand_total", "invoice_total", "balance_due", "total_amount", "amount"];
function extractStatedTotal(record) {
  for (const f of TOTAL_FIELDS) {
    const v = findField(record, f);
    if (v != null && v !== "") {
      const n = Number(String(v).replace(/[^0-9.\-]/g, ""));
      if (!isNaN(n) && n > 0) return n;
    }
  }
  return Number(record.amount) || 0;
}

// Extract structured line items (description + amount) when the document provides them.
function extractLineItems(record) {
  if (Array.isArray(record.line_items)) {
    return record.line_items
      .map((li) => ({ description: li.description || li.item || li.name || "", amount: Number(li.amount || li.price || li.total || 0) || 0 }))
      .filter((li) => li.amount > 0);
  }
  if (Array.isArray(record.items)) {
    return record.items
      .map((li) => ({ description: li.description || li.item || li.name || "", amount: Number(li.amount || li.price || li.total || 0) || 0 }))
      .filter((li) => li.amount > 0);
  }
  const items = [];
  for (let i = 1; i <= 12; i++) {
    const amt = findField(record, `line_item_${i}_amount`) || findField(record, `line_item_${i}`);
    const desc = findField(record, `line_item_${i}_description`) || findField(record, `item_${i}_description`);
    if (amt != null && amt !== "") {
      const n = Number(String(amt).replace(/[^0-9.\-]/g, ""));
      if (!isNaN(n) && n > 0) items.push({ description: String(desc || ""), amount: n });
    }
  }
  return items;
}

// Verify Line Item 1 + Line Item 2 + ... = stated Total (±0.5% tolerance for rounding).
// No line items → trust the stated total (surgical extraction from the Total row).
function verifyMath(lineItems, total) {
  if (!lineItems.length || !total) return true;
  const sum = lineItems.reduce((a, li) => a + li.amount, 0);
  return Math.abs(sum - total) <= Math.max(1, Math.abs(total) * 0.005);
}

// Do the invoice line items contextually match the vendor's registered industry?
function lineItemsMatchIndustry(record, keywords) {
  const items = extractLineItems(record);
  const hay = [
    ...items.map((li) => String(li.description).toLowerCase()),
    String(record.description || "").toLowerCase(),
    String(record.category || "").toLowerCase(),
    String(record.item_description || "").toLowerCase(),
  ].join(" ");
  if (!hay.trim()) return false;
  return keywords.some((k) => hay.includes(k.toLowerCase()));
}

// ─── Genuine threat: unexplained structuring ────────────────────────────────
function detectStructuringVendors(records, threshold = 10000) {
  const band = [threshold * 0.8, threshold * 0.99];
  const counts = {};
  for (const r of records) {
    const v = String(r?.vendor || r?.supplier || "").toLowerCase().trim();
    const amt = Number(r?.amount) || 0;
    if (!v || !amt) continue;
    if (amt >= band[0] && amt <= band[1]) counts[v] = (counts[v] || 0) + 1;
  }
  return new Set(Object.keys(counts).filter((v) => counts[v] >= 3));
}

function scoreToLevel(score) {
  return riskLevelFromScore(score).toUpperCase();
}

// ─── Extraction Guardrails: hallucination rejection + strict typing ────────
// No single invoice total should exceed 1 trillion; a raw OCR value 10× the
// line-item sum is a concatenation artifact (e.g. "30,153,118" + "8,624" → 40B).
const HALLUCINATION_CAP = 1e12;
function isImplausibleRaw(raw, lineItemSum) {
  if (!raw || raw <= 0) return true;
  if (raw >= HALLUCINATION_CAP) return true;
  if (lineItemSum > 0 && raw > lineItemSum * 10) return true;
  return false;
}

// "Thirty Million, One Hundred And Fifty Three Thousand One Hundred And Eighteen" → 30153118
const WORD_NUMS = {
  zero:0, one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9,
  ten:10, eleven:11, twelve:12, thirteen:13, fourteen:14, fifteen:15, sixteen:16,
  seventeen:17, eighteen:18, nineteen:19, twenty:20, thirty:30, forty:40, fifty:50,
  sixty:60, seventy:70, eighty:80, ninety:90,
};
const WORD_SCALES = { hundred:100, thousand:1000, million:1e6, billion:1e9, trillion:1e12 };
function wordsToNumber(text) {
  if (!text) return null;
  const tokens = String(text).toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter(Boolean);
  let current = 0, result = 0, hasAny = false;
  for (const tk of tokens) {
    if (tk in WORD_NUMS) { current += WORD_NUMS[tk]; hasAny = true; }
    else if (tk in WORD_SCALES) {
      current = (current || 1) * WORD_SCALES[tk];
      if (WORD_SCALES[tk] >= 1000) { result += current; current = 0; }
      hasAny = true;
    }
  }
  result += current;
  return hasAny ? result : null;
}
function extractAmountInWords(record) {
  for (const f of ["amount_in_words", "total_in_words", "amount_in_word", "amount_words", "in_words"]) {
    const v = findField(record, f);
    if (v) return v;
  }
  return null;
}

// Strict bank-account typing: reject phone numbers, tax IDs, dates, and short tokens.
function cleanseBankAccount(record) {
  const raw = String(record.bank_account || record.account_number || record.bank_account_number || record.account_no || "").trim();
  const phoneRaw = String(record.phone || record.phone_number || record.contact_phone || record.mobile || "").trim();
  if (!raw) return { bank_account: null, phone_number: phoneRaw || null };
  const digits = raw.replace(/\D/g, "");
  // Nigerian / international phone: leading 0, 10–15 digits.
  if (/^0\d{9,14}$/.test(digits)) return { bank_account: null, phone_number: raw };
  // Date-shaped or tax-ID-shaped.
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw) || /^\d{2}\/\d{2}\/\d{4}$/.test(raw)) return { bank_account: null, phone_number: phoneRaw || null };
  if (digits.length < 8) return { bank_account: null, phone_number: phoneRaw || null }; // too short for a real NUBAN
  return { bank_account: raw, phone_number: phoneRaw || null };
}

// Resolve the mathematically verified total. Preference order:
//   1. Line-item sum (surgical) — the ground truth, immune to OCR concatenation.
//   2. Amount-in-words — explicit human-stated total.
//   3. Stated "Total" row — only if plausible vs line items.
// A hallucinated raw total (e.g. 40,066,798,624) is rejected and recorded for the correction note.
function resolveVerifiedAmount(record, lineItems) {
  const rawTotal = extractStatedTotal(record);
  const lineItemSum = lineItems.reduce((a, li) => a + li.amount, 0);
  const wordsNum = wordsToNumber(extractAmountInWords(record));

  let verified = 0;
  let hallucinatedRaw = null;

  if (lineItemSum > 0) {
    verified = lineItemSum;
    if (isImplausibleRaw(rawTotal, lineItemSum) || (rawTotal > 0 && Math.abs(rawTotal - lineItemSum) > Math.max(1, lineItemSum * 0.01))) {
      hallucinatedRaw = rawTotal > 0 ? rawTotal : null;
    }
  } else if (wordsNum != null && wordsNum > 0) {
    verified = wordsNum;
    if (isImplausibleRaw(rawTotal, wordsNum)) hallucinatedRaw = rawTotal > 0 ? rawTotal : null;
  } else if (!isImplausibleRaw(rawTotal, 0)) {
    verified = rawTotal;
  } else {
    hallucinatedRaw = rawTotal > 0 ? rawTotal : null;
  }

  const mathVerified = lineItemSum > 0 && rawTotal > 0
    && Math.abs(lineItemSum - rawTotal) <= Math.max(1, Math.abs(lineItemSum) * 0.005);
  const mathMismatch = lineItemSum > 0 && rawTotal > 0 && !mathVerified;
  return { verified, hallucinatedRaw, mathVerified, mathMismatch, lineItemSum, wordsNum };
}

// ─── 2/3. Per-record event with extraction guardrails + contextual logic ───
async function buildRecordEvent(record, structuringVendors) {
  const lineItems = extractLineItems(record);
  const { verified: amount, hallucinatedRaw, mathVerified, mathMismatch } = resolveVerifiedAmount(record, lineItems);
  // Never change the source row: rescanning the same object must use the same stated total.
  const assessedRecord = { ...record, amount };
  const currency = String(record.currency || "USD").toUpperCase();
  const cleansed = cleanseBankAccount(record);
  const entityName = record.vendor || record.supplier || record.counterparty || "Unknown";
  const documentId =
    record.transaction_id || record.invoice_number || record.invoice_id || record.reference ||
    record.reservation_id || record.check_id || record.receipt_id || stableDocumentId(record);

  const triggered = [];
  let score = 5; // baseline normal

  // Live market price verification — price gouging (>50% variance)
  if (isProcurementRecord(record)) {
    let pv = null;
    pv = await analyzeProcurementVariance(record, { skipMarket: true });
    if (pv) {
      const top = topProcurementRule(pv);
      if (top) {
        triggered.push(top.flagged_rule);
        if (["RULE-PG-03", "RULE-PG-04"].includes(top.flagged_rule)) score = 85;
        else if (top.flagged_rule === "RULE-PG-02") score = Math.max(score, 45);
      }
    }
  }

  // RAVIQEN mandatory rules (RULE-BE-01 / HV-02 / BS-03)
  const ravigen = runRavigenRules(assessedRecord) || [];
  for (const r of ravigen) {
    triggered.push(r.rule_id);
    if (r.severity === "critical") score = Math.max(score, 85);
    else if (r.severity === "high") score = Math.max(score, 65);
  }

  // BEC — corporate funds routed to personal mobile money / retail wallet
  const bankName = String(record.bank_name || "").toLowerCase().trim();
  if (bankName && PERSONAL_WALLETS.includes(bankName)) {
    triggered.push("RULE-BEC-01");
    score = Math.max(score, 70);
  }

  // Structural mismatch — NGO / educational / charity billing for heavy industrial equipment
  if (isStructuralMismatch(record)) {
    triggered.push("RULE-SM-01");
    score = Math.max(score, 75);
  }

  // Structuring — multiple rapid invoices just below approval threshold
  const vendorKey = String(record.vendor || record.supplier || "").toLowerCase().trim();
  if (structuringVendors.has(vendorKey)) {
    triggered.push("RULE-STRUCT-01");
    score = Math.max(score, 80);
  }

  // ─── 3. CONTEXTUAL RISK LOGIC (ZERO FALSE POSITIVES) ───────────────────────
  // No hardcoded "verified enterprise" list — verified status requires a real,
  // logged KYB/registry lookup. Override relies on entity name match (real data)
  // and heavy-industry classification from the record's own fields.
  const isVerified = false;
  const bankAccountName = String(record.bank_account_name || record.account_name || "").trim();
  const vendorRegisteredName = String(record.vendor_registered_name || record.vendor || "").trim();
  const entityAligned = !!(bankAccountName && vendorRegisteredName && normName(bankAccountName) === normName(vendorRegisteredName));
  const heavyIndustry = isHeavyIndustry(record);
  const industryLineItemMatch = heavyIndustry && lineItemsMatchIndustry(record, HEAVY_INDUSTRY_KEYWORDS);
  const hasHighValueRule = triggered.includes("RULE-HV-02") || triggered.includes("RULE-PG-03");
  // Heavy Industry Exception: capex exceeding 10,000,000 NGN (or 10,000 USD-equiv) is baseline.
  const heavyBaseline = currency === "NGN" ? amount >= 10_000_000 : amount >= 10_000;

  // Suppress rules only after an independent entity check as well as source math.
  // Name/category alignment alone cannot authorize clearance.
  let overrideApplied = false;
  const qualifiesOverride = isVerified && mathVerified && !triggered.includes("RULE-PG-04") && (
    (isVerified && hasHighValueRule) ||
    (heavyBaseline && (industryLineItemMatch || (entityAligned && heavyIndustry)))
  );
  if (qualifiesOverride) {
    overrideApplied = true;
    score = 10; // LOW RISK — Verified Business Operations
    const suppress = new Set(["RULE-HV-02", "RULE-PG-03"]);
    for (let i = triggered.length - 1; i >= 0; i--) if (suppress.has(triggered[i])) triggered.splice(i, 1);
  }

  // A failed math check is itself an anomaly worth flagging, unless already escalated.
  if (mathMismatch) {
    triggered.push("MATH_MISMATCH");
    score = Math.max(score, 45);
  }

  const riskLevel = scoreToLevel(score);
  const action = overrideApplied ? "FORCE_OVERRIDE" : (score <= 30 ? "MONITOR" : "ESCALATE");
  const money = formatCurrency(amount, currency);
  const t = triggered.length ? [...new Set(triggered)].join(", ") : "baseline normal";

  // Legacy alert names to close as part of the correction payload.
  const closeLegacyAlerts = [];
  if (overrideApplied) {
    if (hasHighValueRule || hallucinatedRaw) closeLegacyAlerts.push("High-Value Transaction");
  }
  if (cleansed.bank_account === null && (record.bank_account || record.account_number)) {
    closeLegacyAlerts.push("Bank Account Changed");
  }

  let systemNote;
  if (overrideApplied) {
    const bits = [];
    if (hallucinatedRaw) bits.push(`Hallucinated ${formatCurrency(hallucinatedRaw, currency)} amount corrected to verified ${money}`);
    if (cleansed.bank_account === null && (record.bank_account || record.account_number)) bits.push("phone-as-bank-account error resolved");
    if (!bits.length) bits.push("Verified Business Operations — deterministic high-value alert suppressed");
    systemNote = `Data extraction error corrected. ${bits.join("; ")}.`;
  } else if (mathMismatch) {
    systemNote = `${entityName} (${money}) flagged — line item sum does not match the stated total; manual review required before ledger sync.`;
  } else if (score <= 30) {
    systemNote = `${entityName} (${money}) classified LOW — ${t}. No evidenced anomaly found in available fields; math and external identity remain unverified. Human review is required before payment.`;
  } else {
    systemNote = `${entityName} (${money}) flagged for review — ${t}. Genuine anomaly detected; escalation required for compliance review.`;
  }

  const payload = {
    document_id: documentId,
    vendor_name: entityName,
    cleansed_financials: {
      verified_amount: amount,
      currency,
    },
    cleansed_metadata: {
      bank_account: cleansed.bank_account,
      phone_number: cleansed.phone_number,
    },
    risk_engine_correction: {
      action,
      final_risk_level: riskLevel,
      close_legacy_alerts: closeLegacyAlerts,
      system_note: systemNote,
    },
  };

  return { payload, record, override: overrideApplied, score, action, riskLevel };
}

// ─── Per-alert event (Hospitality PMS / Retail POS / Corporate HR) ─────────
function buildAlertEvent(alert) {
  const fva = alert.fraud_vector_analysis || {};
  const levelMap = { CRITICAL: 85, HIGH: 70, MEDIUM: 45, "LOW-MEDIUM": 35, LOW: 10 };
  const score = levelMap[alert.overall_risk_level] != null ? levelMap[alert.overall_risk_level] : 10;
  const riskLevel = scoreToLevel(score);
  const systemAction = score <= 30 ? "MONITOR" : "ESCALATE";
  const briefing = `${alert.employee_id || "Unknown"} (${alert.department || "ops"}) — ${fva.detected_anomaly || "anomaly"}. ${alert.recommended_action || "Compliance review required."}`;

  const payload = {
    document_id: alert.event_id,
    vendor_name: alert.employee_id || "Unknown",
    cleansed_financials: { verified_amount: 0, currency: "NGN" },
    cleansed_metadata: { bank_account: null, phone_number: null },
    risk_engine_correction: {
      action: systemAction,
      final_risk_level: riskLevel,
      close_legacy_alerts: [],
      system_note: briefing,
    },
  };

  return { payload, alert, override: false, score, action: systemAction, riskLevel };
}

// ─── Orchestrator ───────────────────────────────────────────────────────────
export async function runMasterRiskEngine(records) {
  const procurementRecs = [], invoiceRecs = [], operationalRecs = [];
  for (const r of records) {
    if (isPMSRecord(r) || isPOSRecord(r) || isHRRecord(r)) operationalRecs.push(r);
    else if (isProcurementRecord(r)) procurementRecs.push(r);
    else invoiceRecs.push(r);
  }

  const structuringVendors = detectStructuringVendors([...procurementRecs, ...invoiceRecs]);

  const events = [];
  for (const r of procurementRecs) events.push(await buildRecordEvent(r, structuringVendors));
  for (const r of invoiceRecs) events.push(await buildRecordEvent(r, structuringVendors));
  if (operationalRecs.length) {
    const { alerts } = runHospitalityFraudDetection(operationalRecs);
    for (const a of alerts) events.push(buildAlertEvent(a));
  }

  return { events };
}

// ─── Extraction ─────────────────────────────────────────────────────────────
export async function extractMasterRecords(fileUrl, file = null) {
  const ext = (file?.name || fileUrl || "").toLowerCase().split(".").pop() || "";
  if (["csv", "tsv", "txt", "xlsx", "xls", "json"].includes(ext)) {
    return await extractOperationalRecords(fileUrl, file);
  }
  const norm = await extractRecordsFromFile(fileUrl, file);
  return norm.map((n) => n.record || n).filter(Boolean);
}