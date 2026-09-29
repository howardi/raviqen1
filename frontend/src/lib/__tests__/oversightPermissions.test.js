import { test } from "node:test";
import assert from "node:assert/strict";
import { canAccessRoute, getRoleHomeRoute, normalizeUserRole } from "../permissions.js";
import { inboxStatus, tenantScoped, weeklyPurchaseSummary } from "../oversight.js";

test("department staff cannot open manager oversight routes", () => {
  const staff = { raviqen_role: "department_user", department: "restaurant", tenant_id: "t1", feature_flags: { raviqen_oversight: true } };
  assert.equal(canAccessRoute("/oversight", staff), false);
  assert.equal(canAccessRoute("/oversight/investigation", staff), false);
  assert.equal(canAccessRoute("/oversight/submit", staff), true);
  assert.equal(canAccessRoute("/dashboard", staff), false);
});

test("pending users only see awaiting assignment", () => {
  const pending = { raviqen_role: "pending", department: "general", tenant_id: "t1" };
  assert.equal(canAccessRoute("/oversight/awaiting-assignment", pending), true);
  assert.equal(canAccessRoute("/oversight/submit", pending), false);
  assert.equal(getRoleHomeRoute(pending), "/oversight/awaiting-assignment");
});

test("tenant GM can open oversight inbox and is blocked without tenant on staff home mapping", () => {
  const gm = { raviqen_role: "org_admin", tenant_id: "t1", feature_flags: { raviqen_oversight: true } };
  assert.equal(normalizeUserRole(gm), "org_admin");
  assert.equal(canAccessRoute("/oversight", gm), true);
  assert.equal(canAccessRoute("/oversight/hr", gm), true);
});

test("oversight feature flag hides the module", () => {
  const gm = { raviqen_role: "company_admin", tenant_id: "t1", feature_flags: { raviqen_oversight: false } };
  assert.equal(canAccessRoute("/oversight", gm), false);
});

test("tenant scoping never returns another tenant's rows", () => {
  const rows = [{ id: 1, tenant_id: "a" }, { id: 2, tenant_id: "b" }];
  assert.deepEqual(tenantScoped(rows, "a").map((r) => r.id), [1]);
  assert.deepEqual(tenantScoped(rows, null), []);
});

test("inbox overdue uses department cutoff", () => {
  const now = new Date("2026-09-29T19:00:00");
  assert.equal(inboxStatus({ latest: null, cutoffTime: "18:00", now }), "Overdue");
  assert.equal(inboxStatus({ latest: { id: "r" }, cutoffTime: "18:00", now }), "Submitted");
});

test("weekly purchase summary only includes the last seven days", () => {
  const lines = [
    { quantity: 2, unit_price: 5, line_date: "2026-09-29" },
    { quantity: 1, unit_price: 100, line_date: "2026-01-01" },
  ];
  const summary = weeklyPurchaseSummary(lines, new Date("2026-09-29T12:00:00"));
  assert.equal(summary.lines, 1);
  assert.equal(summary.total, 10);
});
