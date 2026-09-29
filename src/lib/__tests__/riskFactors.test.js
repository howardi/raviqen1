import { test } from "node:test";
import assert from "node:assert/strict";
import { computeRiskFactors } from "../riskFactors.js";

const one = [{ transaction_id: "205740", vendor: "G. WILL & CO. LTD", status: "flagged", risk_level: "high", currency: "NGN", location: "Benin City, Edo State, Nigeria", transaction_date: "25th August, 2026" }];

test("single flagged transaction is not evidence of velocity or counterparty risk", () => {
  const result = computeRiskFactors(one, [{ transaction_id: "205740", flag_reasons: ["High-Value Transaction"] }]);
  assert.equal(result.factors.find((f) => f.key === "velocity").score, null);
  assert.equal(result.factors.find((f) => f.key === "counterparty").score, null);
  assert.equal(result.composite, null);
  assert.ok(result.factors.every((f) => f.reason));
});

test("evidenced recipient mismatch names the billed-to party and produces a score", () => {
  const result = computeRiskFactors(one, [{ transaction_id: "205740", flag_evidence: [{ rule_id: "RULE-RM-04", evidence_field: "counterparty", evidence_value: "Access to Success Foundation", detail: 'Invoice billed-to "Access to Success Foundation" does not match the ingesting organization "Whintercom".' }] }]);
  assert.equal(result.factors.find((f) => f.key === "counterparty").score, 100);
  assert.match(result.factors.find((f) => f.key === "counterparty").reason, /Access to Success Foundation.*Whintercom/);
  assert.equal(result.composite, 100);
});