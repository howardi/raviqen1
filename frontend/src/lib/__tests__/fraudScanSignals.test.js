import test from "node:test";
import assert from "node:assert/strict";
import { fraudSignalsFromTransactions } from "../fraudScanSignals.js";

test("shows only evidence-backed fraud indicators from saved scans", () => {
  const [signal] = fraudSignalsFromTransactions([{ id: "t1", vendor: "Supplier", transaction_id: "INV-1", flag_evidence: [
    { flag: "Duplicate invoice", rule_id: "duplicate_invoice", evidence_field: "transaction_id", evidence_value: "INV-1", detail: "Already exists" },
    { flag: "High value", rule_id: "high_value", evidence_field: "amount", evidence_value: "50000" },
    { flag: "Speculative fraud", rule_id: "RULE-PG-04", evidence_field: "amount", evidence_value: "Not specified" },
  ] }]);
  assert.equal(signal.rule, "duplicate_invoice");
  assert.equal(signal.value, "INV-1");
  assert.equal(fraudSignalsFromTransactions([{ flag_evidence: [{ flag: "Risk", rule_id: "RULE-BE-01", evidence_value: "X" }] }]).length, 0);
});