import { test } from "node:test";
import assert from "node:assert/strict";
import { findingsFromIngested } from "../oversightFindings.js";

test("ingested negative cash is a financial finding from the recorded figure", () => {
  const findings = findingsFromIngested([
    { id: "r1", source_report_id: "rep-1", department: "finance", report_date: "2026-09-30", metrics: { cash_position: -20 } },
  ]);
  assert.equal(findings[0].source_id, "rep-1");
  assert.equal(findings[0].category, "Financial anomalies and ledger inconsistencies");
  assert.match(findings[0].attention, /-20/);
});

test("a doubled sales figure between ingested reports is flagged with both dates", () => {
  const findings = findingsFromIngested([
    { id: "a", department: "restaurant", report_date: "2026-09-01", metrics: { sales: 100 } },
    { id: "b", department: "restaurant", report_date: "2026-09-02", metrics: { sales: 300 } },
  ]);
  assert.equal(findings.length, 1);
  assert.match(findings[0].attention, /100/);
  assert.match(findings[0].attention, /300/);
  assert.equal(findings[0].category, "Financial anomalies and ledger inconsistencies");
});
