import { test } from "node:test";
import assert from "node:assert/strict";
import { groundNarrativeAmounts } from "../narrativeAmounts.js";

test("rejects a three-naira drift but keeps the authoritative amount", () => {
  const fallback = { narrative: "Review the open alert.", recommendation: "Human review." };
  assert.deepEqual(groundNarrativeAmounts({ narrative: "205740 is ₦30,153,121", recommendation: "" }, ["₦30,153,118"], "₦30,153,118", fallback), fallback);
  assert.equal(groundNarrativeAmounts({ narrative: "205740 is ₦30,153,118", recommendation: "" }, ["₦30,153,118"], "₦30,153,118", fallback).narrative, "205740 is ₦30,153,118");
});