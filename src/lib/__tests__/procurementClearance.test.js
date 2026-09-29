import { test } from "node:test";
import assert from "node:assert/strict";
import { applyB2BValidationMandate } from "../b2bValidationEngine.js";

for (const [rule, level, status] of [["RULE-PG-02", "medium", "flagged"], ["RULE-PG-03", "critical", "quarantined"]]) {
  test(`${rule} is not cleared by a matching B2B vendor name`, () => {
    const result = applyB2BValidationMandate({
      normalized: { transaction_id: "TEST", vendor: "Sample Ltd", vendor_registered_name: "Sample Ltd", account_name: "Sample Ltd", amount: 100, currency: "NGN", line_items: [{ description: "Supply", quantity: 1, rate: 100, line_total: 100 }] },
      verification: {},
      risk_level: level,
      risk_score: { total: level === "critical" ? 75 : 55 },
      verification_status: status,
      anomaly: { flags: ["Quoted price variance"], details: [] },
      contextual: { entityAligned: true },
      procurement_variance: { overall_procurement_risk: level.toUpperCase(), recommended_action: "Review price evidence", market_variance_analysis: [{ flagged_rule: rule }] },
    });
    assert.equal(result.verification_status, status);
    assert.equal(result.risk_level, level);
    assert.equal(result.ledger_payload.recommendations.recommend_review_for_disbursement, false);
    assert.equal(result.ledger_payload.risk_evaluation.risk_level, level.toUpperCase());
  });
}