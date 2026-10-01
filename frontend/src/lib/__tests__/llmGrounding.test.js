import { test } from "node:test";
import assert from "node:assert/strict";
import {
  claimsAreGrounded,
  groundFinancialImpact,
  groundSanctionsResult,
  groundSimilarCases,
  listingContainsPrice,
} from "../llmGrounding.js";

test("a cited amount must appear in the source record", () => {
  const source = JSON.stringify({ revenue: 1500, covers: 20 });
  assert.equal(claimsAreGrounded("Revenue is 1500.", source), true);
  assert.equal(claimsAreGrounded("Revenue is 9999.", source), false);
  assert.equal(claimsAreGrounded("The vendor is cleared.", source), false);
});

test("a market price counts only when that number is printed on the page", () => {
  assert.equal(listingContainsPrice("Jumia price ₦1,250,000 today", 1250000), true);
  assert.equal(listingContainsPrice("Similar item from 45000", 1250000), false);
  assert.equal(listingContainsPrice("", 100), false);
});

test("sanctions output is never a clearance", () => {
  const result = groundSanctionsResult({ match_status: "cleared", confidence: 99, matched_list: "OFAC" });
  assert.equal(result.match_status, "pending");
  assert.equal(result.confidence, 0);
  assert.equal(result.matched_list, "");
});

test("similar cases and financial impact stay inside recorded ids and the recorded amount", () => {
  assert.deepEqual(groundSimilarCases([
    { investigation_id: "a", title: "Known" },
    { investigation_id: "missing", title: "Invented" },
  ], ["a"]).map((item) => item.investigation_id), ["a"]);
  const impact = groundFinancialImpact(4200);
  assert.equal(impact.estimated_exposure, 4200);
  assert.equal(impact.exposure_range_high, 4200);
});
