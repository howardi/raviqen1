// Only source-backed, fraud-related indicators belong in the shared feed.
// Generic high risk, missing data, and unsubstantiated anomaly labels are excluded.
const FRAUD_RULES = new Set([
  "duplicate_invoice", "bank_account_variance", "split_billing",
  "RULE-BE-01", "RULE-RM-04", "RULE-PG-02", "RULE-PG-03", "RULE-PG-04",
  "PROC-APPROVAL", "PROC-DUPLICATE", "PROC-PEER", "ANOMALY-03",
]);

export function fraudSignalsFromTransactions(transactions) {
  return transactions.flatMap((transaction) => (transaction.flag_evidence || [])
    .filter((e) => (FRAUD_RULES.has(e.rule_id) || String(e.rule_id || "").startsWith("THREAT-"))
      && e.evidence_field && e.evidence_value != null && String(e.evidence_value).trim()
      && !["unknown", "n/a", "not specified", "not provided"].includes(String(e.evidence_value).trim().toLowerCase()))
    .map((e, index) => ({
      id: `${transaction.id}-${e.rule_id}-${index}`,
      created_date: transaction.created_date,
      title: e.flag,
      rule: e.rule_id,
      detail: e.detail,
      field: e.evidence_field,
      value: e.evidence_value,
      source: transaction.source_filename || "Saved transaction scan",
      batchId: transaction.batch_id,
      reference: transaction.transaction_id,
      subject: transaction.vendor,
      risk: transaction.risk_level,
    })));
}