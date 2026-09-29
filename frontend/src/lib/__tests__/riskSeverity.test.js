import { test } from "node:test";
import assert from "node:assert/strict";
import { highestRiskLevel, riskLevelFromScore, resolveRiskLevel } from "../riskSeverity.js";

test("shared severity thresholds classify score 70 as high", () => {
  assert.equal(riskLevelFromScore(70), "high");
  assert.equal(riskLevelFromScore(75), "critical");
  assert.equal(resolveRiskLevel({ risk_score: 70, risk_level: "critical" }), "high");
  assert.equal(highestRiskLevel([{ risk_score: 70 }, { risk_score: 20 }]), "high");
});