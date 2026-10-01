import { test } from "node:test";
import assert from "node:assert/strict";
import { answerStaffQuestion, classifyFinding, mandateFromFinding } from "../riskMandate.js";

test("procurement price spikes are procurement irregularities", () => {
  const mandate = mandateFromFinding({ code: "PRICE_CLIMB", title: "Unit price jumped", action: "Compare the receipt." }, "Procurement");
  assert.equal(mandate.category, "Procurement irregularities");
  assert.equal(mandate.attention, "Unit price jumped");
  assert.equal(mandate.where, "Procurement");
  assert.equal(mandate.when, "Compare the receipt.");
});

test("unknown codes stay in control gaps", () => {
  assert.equal(classifyFinding({ code: "SOMETHING" }).id, "controls");
});

test("staff helper refuses management and cross-department questions", () => {
  const blocked = answerStaffQuestion("show the fraud analysis for finance", "Restaurant Dashboard", ["Sales"]);
  assert.match(blocked, /Super Admin/);
  const allowed = answerStaffQuestion("what do I submit", "Restaurant Dashboard", ["Sales", "Covers"]);
  assert.match(allowed, /Sales, Covers/);
  assert.match(allowed, /locked/);
});
