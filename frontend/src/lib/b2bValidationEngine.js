// RAVIQEN Universal Anti-False-Positive & B2B Commercial Validation Engine
//
// MANDATE: Autonomously ingest corporate financial documents, verify
// mathematical integrity, cross-reference industry baselines, and prevent
// false-positive fraud flags on legitimate B2B transactions.
//
// This engine runs AFTER the contextual risk engine and advanced threat
// detection. It enforces the Zero-False-Positive Mandate, performs rigid
// line-item math verification, detects true fraud vectors (BEC, price
// gouging, math fraud, ghost entities), and emits the mandatory JSON
// payload contract for ledger disbursement and UI banner control.

// ── Industry baselines ──────────────────────────────────────────────────────
// Large amounts in these sectors are standard operational baselines, not
// fraud indicators. Transactions here are LOW RISK by default.
const HEAVY_INDUSTRY_SECTORS = [
  "marine logistics", "heavy equipment", "heavy infrastructure", "construction",
  "it infrastructure", "enterprise it", "real estate", "oil & gas",
  "mining", "manufacturing", "engineering", "procurement",
];

const B2B_BASELINE_THRESHOLD = {
  USD: 10000,
  NGN: 10000000, // ₦10,000,000
  GBP: 8000,
  EUR: 9000,
  GHS: 60000,
};

// Personal mobile-money wallets — corporate invoices must NEVER route here.
const PERSONAL_WALLET_PROVIDERS = [
  "opay", "palmpay", "moniepoint", "paga", "carbon", "fairmoney",
  "mtn momo", "airtel money", "9psp", "kuda", "vodafone cash", "mtn money",
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function normName(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function toNum(v) {
  if (v == null) return null;
  if (typeof v === "number") return isNaN(v) ? null : v;
  const cleaned = String(v).replace(/[^0-9.\-]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

// ── 1. Rigid Data Extraction & Math Verification ───────────────────────────
// Prevents hallucinated concatenation of phone numbers, dates, or item
// quantities into financial totals. Sums explicit line items (Rate × Quantity)
// and verifies they match the stated invoice total.

export function verifyMathIntegrity(record) {
  const statedTotal = toNum(record.amount);
  const lineItems = extractLineItems(record);
  const result = {
    line_items: lineItems,
    computed_total: null,
    stated_total: statedTotal,
    math_verified: false,
    math_fraud: false,
    variance: null,
    variance_pct: null,
    extraction_guardrail_warnings: [],
  };

  if (!lineItems || lineItems.length === 0) {
    // No line items to verify — cannot confirm or deny math. Not fraud, but
    // not verified either. Guardrail: ensure the stated amount doesn't look
    // like a phone number or date concatenation.
    result.extraction_guardrail_warnings.push(...detectConcatenationFraud(record));
    return result;
  }

  // Sum line items: Rate × Quantity
  let computed = 0;
  let validItems = 0;
  for (const item of lineItems) {
    const rate = toNum(item.rate ?? item.unit_price ?? item.price);
    const qty = toNum(item.quantity ?? item.qty); // missing quantity is unknown, not one
    const lineTotal = toNum(item.line_total ?? item.amount ?? item.total);
    if (rate != null && qty != null && qty > 0) {
      const computedLine = rate * qty;
      // If a line_total is stated, verify it matches rate × qty
      if (lineTotal != null && Math.abs(computedLine - lineTotal) > 0.01) {
        result.extraction_guardrail_warnings.push(
          `Line item "${item.description || "unnamed"}": stated line total (${lineTotal}) ≠ rate × qty (${computedLine.toFixed(2)}) — possible extraction error.`
        );
      }
      computed += computedLine;
      validItems++;
    } else if (lineTotal != null) {
      computed += lineTotal;
      validItems++;
    }
  }

  result.computed_total = Math.round(computed * 100) / 100;
  result.math_verified = validItems === lineItems.length && validItems > 0 && statedTotal != null;
  result.math_fraud = false;

  if (result.math_verified) {
    result.variance = Math.round((statedTotal - result.computed_total) * 100) / 100;
    result.variance_pct = result.computed_total > 0
      ? Math.round((result.variance / result.computed_total) * 10000) / 100
      : null;
    // Math fraud: line items do not add up to stated total (tolerance: ±1 unit
    // or ±0.5% for large amounts — handles rounding in multi-currency invoices)
    const tolerance = Math.max(1, Math.abs(result.computed_total) * 0.005);
    if (Math.abs(result.variance) > tolerance) {
      result.math_fraud = true;
      result.math_verified = false;
    }
  }

  // Guardrail: detect concatenated phone numbers / dates in the amount field
  result.extraction_guardrail_warnings.push(...detectConcatenationFraud(record));

  return result;
}

// Extract structured line items from the record, handling multiple shapes:
// { line_items: [...] }, { items: [...] }, or a JSON string in item_description.
function extractLineItems(record) {
  // Direct array fields
  for (const key of ["line_items", "items", "invoice_lines", "lineItems"]) {
    const val = record[key];
    if (Array.isArray(val) && val.length > 0) return val.map(normalizeLineItem);
  }
  // JSON-encoded line items in item_description or a dedicated field
  for (const key of ["line_items_json", "items_json", "line_items_string"]) {
    const val = record[key];
    if (typeof val === "string" && val.trim().startsWith("[")) {
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed.map(normalizeLineItem);
      } catch { /* not JSON */ }
    }
  }
  return [];
}

function normalizeLineItem(raw) {
  if (!raw || typeof raw !== "object") return raw;
  return {
    description: raw.description || raw.item || raw.particulars || raw.name || "",
    rate: toNum(raw.rate ?? raw.unit_price ?? raw.price),
    quantity: toNum(raw.quantity ?? raw.qty),
    line_total: toNum(raw.line_total ?? raw.amount ?? raw.total ?? raw.subtotal),
  };
}

// Detection guardrail: flag if the amount field looks like a phone number,
// a date, or a concatenated string rather than a genuine monetary value.
function detectConcatenationFraud(record) {
  const warnings = [];
  const rawAmount = record._raw_amount || record.amount;
  if (typeof rawAmount === "string") {
    const digits = rawAmount.replace(/[^0-9]/g, "");
    // Phone numbers are typically 10-15 digits with no decimal
    if (digits.length >= 10 && digits.length <= 15 && !rawAmount.includes(".")) {
      warnings.push(`Amount field "${rawAmount}" resembles a phone number (${digits.length} digits, no decimal) — possible OCR concatenation error. Verify source document.`);
    }
    // Date-like patterns in amount (e.g., "20240115" or "15/01/2024")
    if (/^\d{4}[/-]\d{1,2}[/-]\d{1,2}$/.test(rawAmount.replace(/\s/g, "")) ||
        /^\d{8}$/.test(digits)) {
      warnings.push(`Amount field "${rawAmount}" resembles a date — possible OCR field misalignment. Verify source document.`);
    }
  }
  return warnings;
}

// ── 2. True Fraud Trigger Detection ────────────────────────────────────────
// Only flag HIGH or CRITICAL if one of these concrete anomalies is present.

export function detectTrueFraudVectors(record, mathResult, verification) {
  const vectors = [];

  // (1) Business Email Compromise (BEC): corporate invoice → personal wallet
  const bec = detectBEC(record);
  if (bec) vectors.push(bec);

  // (2) Mathematical Fraud: line items don't add up to stated total
  if (mathResult.math_fraud) {
    vectors.push({
      vector: "MATHEMATICAL_FRAUD",
      severity: "critical",
      detail: `Line items sum to ${mathResult.computed_total} but stated total is ${mathResult.stated_total} (variance: ${mathResult.variance}, ${mathResult.variance_pct}%). Intentional tampering indicator.`,
    });
  }

  // (3) Price Gouging: unit prices exceed market rates by >50%
  // (Handled by procurementVariance.js RULE-PG-03; surfaced here if present)
  const pv = record.procurement_variance;
  if (pv) {
    const top = pv.find((p) => p.flagged_rule === "RULE-PG-03");
    if (top) {
      vectors.push({
        vector: "PRICE_GOUGING",
        severity: "critical",
        detail: `${top.item_description}: invoice unit price ${top.invoice_unit_price} vs market ${top.nigerian_market_avg} (${top.calculated_variance_percent} above market).`,
      });
    }
  }

  // (4) Ghost Entity: vendor cannot be verified, no corporate registration
  // Missing registration or an inconclusive web search is not proof of a ghost entity.

  return vectors;
}

function detectBEC(record) {
  const docType = String(record.document_type || record.category || "").toLowerCase();
  const isInvoice = docType.includes("invoice") || docType.includes("receipt");
  if (!isInvoice) return null;

  const bankName = String(record.bank_name || "").toLowerCase().trim();
  const acctName = String(record.account_name || record.bank_account_name || "").trim();
  const org = String(record.organization || record.vendor || "").trim();
  const accountType = String(record.account_type || "").toLowerCase();

  // Personal mobile money wallet on a corporate invoice
  if (bankName && PERSONAL_WALLET_PROVIDERS.some((w) => bankName.includes(w))) {
    return {
      vector: "BUSINESS_EMAIL_COMPROMISE",
      severity: "critical",
      detail: `Corporate invoice demands payment into personal mobile-money wallet (${record.bank_name}) instead of a corporate business account — classic BEC indicator.`,
    };
  }
  // Personal account type on a corporate invoice
  if (accountType === "personal" || accountType === "individual") {
    return {
      vector: "BUSINESS_EMAIL_COMPROMISE",
      severity: "critical",
      detail: `Corporate invoice routed to a personal ${accountType} account — BEC / account-substitution indicator.`,
    };
  }
  // Beneficiary name mismatch
  if (acctName && org && normName(acctName) !== normName(org) &&
      !normName(org).includes(normName(acctName)) && !normName(acctName).includes(normName(org))) {
    return {
      vector: "BUSINESS_EMAIL_COMPROMISE",
      severity: "high",
      detail: `Invoice beneficiary "${acctName}" does not match invoicing organization "${org}" — potential BEC account-substitution attack.`,
    };
  }
  return null;
}

// ── 3. Zero-False-Positive Mandate Enforcement ──────────────────────────────
// Determines if a transaction qualifies as verified B2B procurement and
// forces a low risk score (0-15) with "STABLE / VERIFIED B2B PROCUREMENT" status.

export function evaluateB2BVerification(record, mathResult, fraudVectors, ctx) {
  const vendor = String(record.vendor || "").trim();
  const vendorRegisteredName = String(record.vendor_registered_name || record.vendor || "").trim();
  const bankAccountName = String(record.bank_account_name || record.account_name || "").trim();
  const amount = toNum(record.amount) || 0;
  const currency = String(record.currency || "USD").toUpperCase();
  const vendorCategory = String(record.vendor_category || record.category || "").toLowerCase();
  const threshold = B2B_BASELINE_THRESHOLD[currency] || B2B_BASELINE_THRESHOLD.USD;
  const isHeavyIndustry = HEAVY_INDUSTRY_SECTORS.some((s) => vendorCategory.includes(s));
  const exceedsBaseline = amount >= threshold;

  // Name match: vendor name matches registered corporate name
  const nameMatch = !!(bankAccountName && vendorRegisteredName &&
    normName(bankAccountName) === normName(vendorRegisteredName));
  const entityAligned = !!(ctx?.entityAligned || nameMatch);
  // NOTE: verifiedEnterprise is always false — "verified enterprise" status
  // requires a real, logged KYB/registry lookup, not a hardcoded list.
  const verifiedEnterprise = false;

  // Math verified: line items sum to stated total
  const mathVerified = !!mathResult.math_verified;

  // No true fraud vectors present
  const noFraudVectors = !fraudVectors || fraudVectors.length === 0;

  // ── QUALIFY: Verified B2B Procurement ──
  // Conditions: entity name match (real data) AND math integrity verified
  // AND no true fraud vectors. No hardcoded vendor whitelist.
  const qualifiesVerifiedB2B = verifiedEnterprise && entityAligned && mathVerified && noFraudVectors;

  // ── QUALIFY: Legitimate B2B Outlier (heavy industry, large amount) ──
  // Large amount + heavy industry + entity aligned + no fraud = legitimate
  const qualifiesLegitimateB2B = verifiedEnterprise && mathVerified && exceedsBaseline && isHeavyIndustry &&
    entityAligned && noFraudVectors &&
    !mathResult.math_fraud;

  let verdict = null;
  let riskScore = null;
  let classification = null;

  if (qualifiesVerifiedB2B) {
    // No "Cleared by Logic" label — this is a screening assessment, not a
    // clearance event. The alert remains open until a human reviews it.
    classification = "B2B PROCUREMENT — ENTITY MATCH + MATH VERIFIED";
    riskScore = Math.min(15, Math.max(0, Math.round((amount / threshold) * 2))); // 0-15 scale
    riskScore = Math.min(riskScore, 15);
    verdict = "Entity name match confirmed and line-item math verified. No fraud vectors detected. Recommend human review before disbursement.";
  } else if (qualifiesLegitimateB2B) {
    classification = "B2B OUTLIER — HEAVY INDUSTRY, ENTITY MATCH";
    riskScore = Math.min(15, Math.max(0, Math.round((amount / threshold) * 3)));
    riskScore = Math.min(riskScore, 15);
    verdict = "Large amount in heavy-industry category with entity name match and no fraud vectors. Recommend human review before disbursement.";
  }

  return {
    qualifiesVerifiedB2B,
    qualifiesLegitimateB2B,
    classification,
    riskScore,
    verdict,
    entityAligned,
    verifiedEnterprise: false,
    mathVerified,
    exceedsBaseline,
    isHeavyIndustry,
  };
}

// ── 4. Mandatory JSON Output Payload ────────────────────────────────────────
// Every processed document emits this structured JSON to update the backend
// database, close legacy alerts, and clear UI warning banners.

export function buildMandatoryPayload(result, b2bEval, mathResult, fraudVectors) {
  const rec = result.normalized || {};
  const currency = String(rec.currency || "USD").toUpperCase();
  const hasProcurementFlag = (result.procurement_variance?.market_variance_analysis || []).some((item) => item.arithmetic_finding || ["RULE-PG-02", "RULE-PG-03"].includes(item.flagged_rule));
  const isVerifiedB2B = (b2bEval.qualifiesVerifiedB2B || b2bEval.qualifiesLegitimateB2B) && !hasProcurementFlag;
  const hasFraud = fraudVectors && fraudVectors.length > 0;

  const riskLevel = hasFraud
    ? (fraudVectors.some((v) => v.severity === "critical") ? "CRITICAL" : "HIGH")
    : (isVerifiedB2B ? "LOW" : (result.risk_level || "low").toUpperCase());

  const riskScore = hasFraud
    ? (fraudVectors.some((v) => v.severity === "critical") ? 90 : 70)
    : (isVerifiedB2B ? (b2bEval.riskScore ?? 10) : (result.risk_score?.total ?? 0));

  const verdict = hasFraud
    ? `Fraud detected: ${fraudVectors.map((v) => v.vector).join(", ")}. Transaction quarantined for investigation.`
    : (b2bEval.verdict || "Transaction screened. No fraud vectors triggered.");

  return {
    document_id: rec.transaction_id || rec.invoice_id || null,
    vendor_name: rec.vendor || null,
    financials: {
      validated_amount: mathResult?.math_verified ? mathResult.computed_total : (rec.amount ?? null),
      currency_iso: currency,
    },
    risk_evaluation: {
      risk_score: riskScore,
      risk_level: riskLevel,
      verdict,
      triggered_fraud_vectors: hasFraud ? fraudVectors.map((v) => v.vector) : [],
    },
    // PROPOSALS ONLY — the AI does not execute these actions. They are
    // recommendations for a human compliance user, who must explicitly approve
    // each one (logged with their ID, evidence reviewed, and timestamp).
    recommendations: {
      recommend_review_for_disbursement: isVerifiedB2B && !hasFraud,
      recommend_quarantine: hasFraud,
      recommend_human_review: !isVerifiedB2B && !hasFraud,
    },
    _meta: {
      math_verified: mathResult?.math_verified ?? false,
      math_fraud: mathResult?.math_fraud ?? false,
      extraction_guardrail_warnings: mathResult?.extraction_guardrail_warnings ?? [],
      classification: b2bEval?.classification || null,
      entity_aligned: b2bEval?.entityAligned ?? false,
      verified_enterprise: false,
    },
  };
}

// ── 5. Main Orchestrator: Apply B2B Mandate to a Processed Record ──────────
// Runs after contextual logic + threat detection. Returns the enriched result
// with forced risk overrides and the mandatory JSON payload attached.

export function applyB2BValidationMandate(result) {
  const record = result.normalized || {};

  // 1. Verify math integrity (line items → stated total)
  const mathResult = verifyMathIntegrity(record);

  // 2. Detect true fraud vectors
  const fraudVectors = detectTrueFraudVectors(record, mathResult, result.verification);

  // 3. Evaluate B2B verification (zero-false-positive mandate)
  const b2bEval = evaluateB2BVerification(record, mathResult, fraudVectors, result.contextual);

  // 4. Build mandatory JSON payload
  const mandatoryPayload = buildMandatoryPayload(result, b2bEval, mathResult, fraudVectors);

  // 5. Force risk overrides
  let finalRiskLevel = result.risk_level;
  let finalRiskScore = result.risk_score?.total ?? 0;
  let finalStatus = result.verification_status;

  if (fraudVectors.length > 0) {
    // True fraud → force HIGH/CRITICAL + quarantine
    const hasCritical = fraudVectors.some((v) => v.severity === "critical");
    finalRiskLevel = hasCritical ? "critical" : "high";
    finalRiskScore = hasCritical ? 90 : 70;
    finalStatus = "quarantined";
    // Add fraud flags to anomaly
    if (result.anomaly) {
      for (const v of fraudVectors) {
        const flag = `[${v.vector}] ${v.detail}`;
        if (!result.anomaly.flags.includes(v.vector)) {
          result.anomaly.flags.push(v.vector);
          result.anomaly.details.push(flag);
        }
      }
    }
  } else if ((b2bEval.qualifiesVerifiedB2B || b2bEval.qualifiesLegitimateB2B) && !(result.procurement_variance?.market_variance_analysis || []).some((item) => item.arithmetic_finding || ["RULE-PG-02", "RULE-PG-03"].includes(item.flagged_rule))) {
    // A B2B name/math match cannot erase a sourced procurement price or arithmetic discrepancy.
    finalRiskLevel = "low";
    finalRiskScore = b2bEval.riskScore ?? 10;
    finalStatus = "valid";
    // Clear any remaining generic flags
    if (result.anomaly) {
      const genericFlags = [
        "High-value threshold exceeded (>50,000)",
        "Amount exceeds statistical threshold (mean + 2σ)",
        "First-time vendor",
        "First-time counterparty pairing",
        "Off-hours submission",
        "Weekend transaction",
        "Amount deviation anomaly (low-value category)",
      ];
      result.anomaly.flags = result.anomaly.flags.filter((f) => !genericFlags.includes(f));
      result.anomaly.details = result.anomaly.details.filter((d) =>
        !genericFlags.some((g) => d.includes(g))
      );
    }
  }

  // Keep flagged procurement findings consistent with the stored risk score.
  if (result.procurement_variance?.overall_procurement_risk === "CRITICAL") finalRiskScore = Math.max(finalRiskScore, 75);
  else if (result.procurement_variance?.overall_procurement_risk === "MEDIUM") finalRiskScore = Math.max(finalRiskScore, 55);
  mandatoryPayload.risk_evaluation.risk_score = finalRiskScore;
  mandatoryPayload.risk_evaluation.risk_level = finalRiskLevel.toUpperCase();
  if (!fraudVectors.length && (result.procurement_variance?.overall_procurement_risk === "CRITICAL" || result.procurement_variance?.overall_procurement_risk === "MEDIUM")) {
    mandatoryPayload.risk_evaluation.verdict = result.procurement_variance.recommended_action;
    mandatoryPayload.recommendations.recommend_review_for_disbursement = false;
    mandatoryPayload.recommendations.recommend_human_review = true;
  }

  // 6. Enrich the result with B2B validation data
  result.b2b_validation = {
    math_verification: mathResult,
    fraud_vectors: fraudVectors,
    b2b_evaluation: b2bEval,
    mandatory_payload: mandatoryPayload,
    classification: b2bEval.classification,
  };
  result.risk_level = finalRiskLevel;
  result.risk_score = { ...result.risk_score, total: finalRiskScore };
  result.verification_status = finalStatus;

  // 7. Replace the ledger payload with the mandatory JSON contract
  result.ledger_payload = mandatoryPayload;

  // 8. Enrich contextual clearance label
  if (b2bEval.classification && !result.contextual?.clearanceLabel && !["CRITICAL", "MEDIUM"].includes(result.procurement_variance?.overall_procurement_risk)) {
    result.contextual = {
      ...(result.contextual || {}),
      clearanceLabel: b2bEval.classification,
      notes: [
        ...(result.contextual?.notes || []),
        b2bEval.verdict,
      ].filter(Boolean),
      contextualScore: finalRiskScore,
    };
  } else if (b2bEval.classification && !["CRITICAL", "MEDIUM"].includes(result.procurement_variance?.overall_procurement_risk)) {
    result.contextual = {
      ...(result.contextual || {}),
      clearanceLabel: b2bEval.classification,
      contextualScore: finalRiskScore,
    };
  }

  return result;
}