// RAVIQEN Contextual False-Positive Prevention Engine
// Runs AFTER base anomaly detection to suppress benign B2B signals and
// escalate genuine fraud indicators, producing a Contextual Risk Score and
// clearance labels ("GENUINE B2B OUTLIER - CLEARED BY LOGIC", "APPROVED_BY_CONTRACT").

const STANDARD_THRESHOLD_USD = 50000;
const STANDARD_THRESHOLD_NGN = 30000000;
const HEAVY_INDUSTRY = ["Marine Logistics", "Heavy Equipment", "Heavy Infrastructure", "Construction", "IT Infrastructure", "Enterprise IT", "Real Estate"];
const LOW_VALUE_CATEGORIES = ["Office Supplies", "Consulting", "Subscriptions"];

function normName(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, ""); }

// NOTE: "Verified enterprise" status is NEVER asserted from a hardcoded list.
// Sector classification and verified-enterprise status require a real, logged
// KYB/registry lookup (with source cited inline). If no such verified
// classification exists, the system must say "Sector: unverified" — never
// assert a sector or "verified enterprise" status that isn't backed by data.

function removeFlag(flags, details, flagName) {
  let idx;
  while ((idx = flags.indexOf(flagName)) !== -1) {
    flags.splice(idx, 1);
    details.splice(idx, 1);
  }
}

export function applyContextualLogic(record, anomaly, baseline = []) {
  const flags = [...(anomaly.flags || [])];
  const details = [...(anomaly.details || [])];
  let ravigen = [...(anomaly.ravigen || [])];
  const notes = [];
  let clearanceLabel = null;
  let approvedByContract = false;
  let genuineB2BOutlier = false;
  let amountDeviationSuppressed = false;

  const vendorStatus = String(record.vendor_status || "").toLowerCase();
  const accountType = String(record.account_type || "").toLowerCase();
  const bankAccountName = String(record.bank_account_name || record.account_name || "").trim();
  const vendorRegisteredName = String(record.vendor_registered_name || record.vendor || "").trim();
  const vendorCategory = String(record.vendor_category || "").trim();
  const docType = String(record.document_type || record.category || "").toLowerCase();
  const amount = Number(record.amount) || 0;
  const currency = String(record.currency || "USD").toUpperCase();
  const standardThreshold = currency === "NGN" ? STANDARD_THRESHOLD_NGN : STANDARD_THRESHOLD_USD;
  const invoiceStatus = String(record.invoice_status || record.status || "").toLowerCase();
  const exceedsStandard = amount > standardThreshold;

  const isHeavyIndustry = HEAVY_INDUSTRY.some((c) => vendorCategory.toLowerCase() === c.toLowerCase());
  const isLowValue = LOW_VALUE_CATEGORIES.some((c) => vendorCategory.toLowerCase() === c.toLowerCase());

  // ── Rule 1: Vendor Onboarding Logic ────────────────────────────────────
  const newVendorFlagged = flags.includes("First-time vendor") || vendorStatus === "new";
  if (newVendorFlagged) {
    const nameMatch = !!(bankAccountName && vendorRegisteredName && bankAccountName.toLowerCase() === vendorRegisteredName.toLowerCase());
    if (accountType === "corporate" && nameMatch) {
      removeFlag(flags, details, "First-time vendor");
      removeFlag(flags, details, "First-time counterparty pairing");
      notes.push("New-vendor penalty nullified: corporate account with bank account name exactly matching registered vendor name.");
    } else if (accountType === "personal" || (bankAccountName && vendorRegisteredName && !nameMatch)) {
      if (!flags.includes("Potential BEC / shell entity (new vendor, account mismatch)")) {
        flags.push("Potential BEC / shell entity (new vendor, account mismatch)");
        details.push("New vendor with personal account or bank account name not matching registered vendor name — potential BEC or shell entity.");
      }
    }
  }

  // ── Rule 2: Dynamic Amount Thresholds (per-record, no cross-record baseline) ──
  if (exceedsStandard) {
    if (isHeavyIndustry) {
      // Heavy-industry large amounts are standard operational baselines.
      // Suppress amount-deviation flags unconditionally — each case is judged
      // on its own merits (vendor match + math integrity), not relative to
      // other records' amounts.
      removeFlag(flags, details, "High-value threshold exceeded (>50,000)");
      removeFlag(flags, details, "Amount exceeds statistical threshold (mean + 2σ)");
      amountDeviationSuppressed = true;
      notes.push("CapEx/Heavy-Industry tier applied: amount-deviation flags suppressed (large amounts are standard operational baseline in this sector).");
    } else if (isLowValue) {
      if (!flags.includes("Amount deviation anomaly (low-value category)")) {
        flags.push("Amount deviation anomaly (low-value category)");
        details.push(`High amount for a low-value vendor category (${vendorCategory}) — amount deviation anomaly.`);
      }
    }
  }

  // ── Rule 3: Timestamp & Metadata Logic ─────────────────────────────────
  if (docType.includes("invoice") || docType.includes("purchase order") || docType.includes("po")) {
    if (flags.includes("Off-hours submission")) {
      removeFlag(flags, details, "Off-hours submission");
      notes.push("Off-hours timestamp ignored for invoice/purchase order (B2B automated billing / ERP batch processing).");
    }
    if (flags.includes("Weekend transaction")) {
      removeFlag(flags, details, "Weekend transaction");
      notes.push("Weekend timestamp ignored for invoice/purchase order (global supply-chain scheduling).");
    }
  }

  // ── Rule 4: Whitelist Override ──────────────────────────────────────────
  const whitelisted = record.trusted_whitelist === true || String(record.vendor_whitelist || "").toLowerCase() === "trusted_enterprise_whitelist";
  if (whitelisted && invoiceStatus === "verified_against_contract") {
    removeFlag(flags, details, "High-value threshold exceeded (>50,000)");
    removeFlag(flags, details, "Amount exceeds statistical threshold (mean + 2σ)");
    removeFlag(flags, details, "First-time vendor");
    removeFlag(flags, details, "First-time counterparty pairing");
    removeFlag(flags, details, "Off-hours submission");
    removeFlag(flags, details, "Weekend transaction");
    removeFlag(flags, details, "Amount deviation anomaly (low-value category)");
    removeFlag(flags, details, "Potential BEC / shell entity (new vendor, account mismatch)");
    ravigen = ravigen.filter((r) => r.severity !== "high" && r.severity !== "critical");
    approvedByContract = true;
    clearanceLabel = "APPROVED_BY_CONTRACT";
    notes.push("Whitelist override: vendor on Trusted Enterprise Whitelist and invoice verified against contract — quarantine bypassed.");
  }

  // ── Rule 5: Entity Alignment Check ──────────────────────────────────────
  const entityAligned = !!(bankAccountName && vendorRegisteredName && normName(bankAccountName) === normName(vendorRegisteredName));
  if (entityAligned) {
    removeFlag(flags, details, "Potential BEC / shell entity (new vendor, account mismatch)");
    removeFlag(flags, details, "First-time vendor");
    removeFlag(flags, details, "First-time counterparty pairing");
    notes.push("Entity alignment verified: registered business name exactly matches corporate receiving bank account — counterparty risk Low / Verified Entity.");
  }

  // ── Rule 6: REMOVED — No hardcoded "verified enterprise" overrides. ──────
  // Sector classification and verified-enterprise status require a real,
  // logged KYB/registry lookup. The contextual engine may suppress flags
  // based on actual record data (entity name match, heavy-industry category
  // from the record's vendor_category field) but must NOT assert "verified
  // enterprise" status or "cleared by logic" — those are fabricated claims
  // unless backed by a cited data source.
  const verifiedEnterprise = false;

  // ── Rule 7: Industry-Calibrated Flag Suppression (no clearance labels) ──
  // If the record's vendor_category indicates heavy industry AND the entity
  // name is aligned (real data check), suppress the high-value flags. But
  // do NOT assign a "Cleared by Logic" label — that implies an automated
  // clearance event, which requires a real, logged action.
  if (exceedsStandard && isHeavyIndustry && entityAligned) {
    ravigen = ravigen.filter((r) => r.rule_id !== "RULE-HV-02");
    removeFlag(flags, details, "High-value threshold exceeded (>50,000)");
    removeFlag(flags, details, "Amount exceeds statistical threshold (mean + 2σ)");
    removeFlag(flags, details, "Amount deviation anomaly (low-value category)");
    notes.push(`Heavy-industry category with entity name match: high-value flags suppressed. Sector: ${vendorCategory || "unverified"}. Note: sector classification is from record data, not a verified registry lookup.`);
  }

  return { flags, details, ravigen, notes, clearanceLabel: null, approvedByContract: false, genuineB2BOutlier: false, entityAligned, verifiedEnterprise: false };
}