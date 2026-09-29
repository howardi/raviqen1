import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeReportFraud, buildInvestigationReport } from "../reportFraud.js";

test("storekeeper price spike is a critical fraud finding", () => {
  const result = analyzeReportFraud({
    report: { department: "procurement", metrics: { stock_received: 10, stock_issued: 4 } },
    purchases: [
      { item: "Rice", unit_price: 10, quantity: 2, supplier: "A" },
      { item: "Salt", unit_price: 12, quantity: 1, supplier: "A" },
      { item: "Oil", unit_price: 90, quantity: 1, supplier: "" },
    ],
  });
  assert.equal(result.risk_level, "critical");
  assert.ok(result.findings.some((item) => item.code === "PRICE_VARIANCE"));
  assert.ok(result.findings.some((item) => item.code === "SUPPLIER"));
});

test("restaurant wastage above sales is critical", () => {
  const result = analyzeReportFraud({
    report: { department: "restaurant", metrics: { sales: 100, covers: 20, wastage: 250 } },
  });
  assert.equal(result.risk_level, "critical");
});

test("investigation report names the highest priority finding", () => {
  const report = buildInvestigationReport({
    departments: [{ slug: "restaurant", nav_label: "Restaurant Dashboard" }],
    reports: [{ id: "1", department: "restaurant", title: "Tuesday service", metrics: { sales: 10, wastage: 40, covers: 2 } }],
    issues: [{ title: "Wastage review", status: "open", owner: "GM" }],
  });
  assert.match(report.executive_summary, /Tuesday service/);
  assert.equal(report.findings.length > 0, true);
  assert.equal(report.issues[0].owner, "GM");
});
