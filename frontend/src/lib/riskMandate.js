export const RISK_CATEGORIES = [
  {
    id: "transactions",
    label: "Unusual and unauthorized transactions",
    codes: ["ZERO_REVENUE", "COVERS", "DUPLICATE_LINE", "SPLIT", "VARIANCE"],
  },
  {
    id: "controls",
    label: "Control gaps and compliance oversights",
    codes: ["CORRECTION", "MISSING_RECEIPT", "SUPPLIER", "UNCHANGED", "ZERO_PRICE", "ZERO_QTY"],
  },
  {
    id: "procurement",
    label: "Procurement irregularities",
    codes: ["PRICE_VARIANCE", "PRICE_CLIMB", "STOCK"],
  },
  {
    id: "financial",
    label: "Financial anomalies and ledger inconsistencies",
    codes: ["PAYMENTS", "CASH", "NEGATIVE"],
  },
  {
    id: "operations",
    label: "Operational exceptions",
    codes: ["WASTAGE", "OCCUPANCY", "CHECKOUT_SPIKE", "FAULTS", "LEAVE", "EXCEPTIONS"],
  },
];

export function classifyFinding(finding) {
  const code = String(finding?.code || "");
  return RISK_CATEGORIES.find((category) => category.codes.includes(code)) || RISK_CATEGORIES[1];
}

export function answerStaffQuestion(question, departmentLabel, fieldLabels) {
  const asked = String(question || "").toLowerCase();
  const fields = (fieldLabels || []).filter(Boolean).join(", ") || "the fields on your form";
  if (/\b(fraud|risk score|other department|manager|ingest|investigation|anomaly|analysis)\b/.test(asked)) {
    return "This helper only covers your own daily report. Management review, other departments, and risk findings stay with your Super Admin.";
  }
  return `Your ${departmentLabel} report asks for: ${fields}. After you submit, the report is locked. Send a new report if you need to correct it.`;
}

export function mandateFromFinding(finding, where) {
  const category = classifyFinding(finding);
  return {
    category: finding?.category || category.label,
    attention: finding?.attention || finding?.title || finding?.observation || "Review the recorded figure",
    where: finding?.where || where || finding?.department || "This department",
    when: finding?.when || finding?.action || finding?.follow_up || "Before the report is ingested",
  };
}
