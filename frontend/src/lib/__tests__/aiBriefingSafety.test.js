// RAVIQEN invariant: the AI Risk Briefing must never fabricate compliance
// clearances, verification status, or payment-release recommendations for
// transactions that are still open/flagged/critical.
//
// Regression origin: generateDashboardNarrative's prompt contained hardcoded
// "verified enterprise whitelist" entries, "Cleared by Logic" clearance labels,
// and industry-calibration suppression rules. The LLM was instructed to
// override real risk levels and recommend payment finalization — contradicting
// the transaction's actual Open/Critical status.
//
// This test pins the post-generation safety guard (validateBriefingSafety): if
// the LLM output contains clearance/resolution/payment language while any source
// alert is unresolved, the guard must discard it and return a safe fallback
// that (a) contains no clearance/verification/whitelist language, (b) contains
// no payment/finalization recommendation, and (c) correctly states the
// transaction is still flagged/open.
//
// Runs on Node's built-in test runner. Wired into the build via the `test`
// script so `npm run build` fails if this invariant regresses.

import { test } from "node:test";
import assert from "node:assert/strict";
import { validateBriefingSafety, SAFE_FALLBACK_BRIEFING } from "../briefingGuard.js";

// The exact scenario reported: transaction 205740, Critical, risk 100, Open.
const alert205740 = {
  title: "Screening flag: G. WILL & CO. LTD",
  transaction_id: "205740",
  vendor: "G. WILL & CO. LTD",
  amount: 30153118,
  currency: "NGN",
  risk_score: 100,
  risk_level: "critical",
  status: "open",
  flag_reasons: ["High-value threshold exceeded (>50,000)"],
};

// A fabricated LLM output of the kind the old prompt produced — clearance
// language + payment recommendation contradicting the Open/Critical status.
const fabricatedClearanceOutput = {
  narrative:
    "G. WILL & CO. LTD is a verified Marine Logistics enterprise on the enterprise whitelist. The transaction aligns with heavy-industry baselines and is cleared by logic. Counterparty risk is Low / Verified Entity.",
  recommendation:
    "Finalize the payment and update the audit log to reflect cleared status. The transaction is safe to disburse.",
  tone: "stable",
};

test("guard discards clearance/payment language for an Open/Critical alert and returns a safe fallback", () => {
  const result = validateBriefingSafety(fabricatedClearanceOutput, [alert205740]);
  const text = `${result.narrative} ${result.recommendation}`.toLowerCase();

  // (a) No clearance / verification / whitelist language
  for (const phrase of [
    "cleared by logic",
    "cleared",
    "clearance",
    "verified entity",
    "verified enterprise",
    "whitelist",
    "whitelisted",
    "approved by contract",
  ]) {
    assert.ok(!text.includes(phrase), `fallback must not contain "${phrase}"`);
  }

  // (b) No payment / finalization recommendation
  for (const phrase of [
    "finalize",
    "finalise",
    "release payment",
    "release funds",
    "disburse",
    "disbursement",
    "approve payment",
    "safe to pay",
    "safe to disburse",
    "payment can proceed",
  ]) {
    assert.ok(!text.includes(phrase), `fallback must not contain "${phrase}"`);
  }

  // (c) Correctly states the transaction is still flagged/open/unresolved
  assert.ok(
    text.includes("flagged") || text.includes("unresolved") || text.includes("open"),
    "fallback must state the transaction remains flagged/unresolved"
  );
});

test("guard preserves a clean output that correctly states the alert is open", () => {
  const cleanOutput = {
    narrative:
      "Transaction 205740 remains flagged and unresolved with a critical risk score of 100. The alert is currently open.",
    recommendation:
      "Recommend a compliance officer review transaction 205740 and its flag reasons before any further action.",
    tone: "critical",
  };
  const result = validateBriefingSafety(cleanOutput, [alert205740]);
  assert.equal(result.narrative, cleanOutput.narrative);
  assert.equal(result.recommendation, cleanOutput.recommendation);
  assert.equal(result.tone, "critical");
});

test("guard returns fallback for null/undefined output", () => {
  const result = validateBriefingSafety(null, [alert205740]);
  assert.equal(result.narrative, SAFE_FALLBACK_BRIEFING.narrative);
  assert.equal(result.recommendation, SAFE_FALLBACK_BRIEFING.recommendation);
});

test("guard does not alter output when all alerts are resolved", () => {
  const resolvedAlert = { ...alert205740, status: "resolved" };
  const output = { narrative: "All clear.", recommendation: "No action needed.", tone: "stable" };
  const result = validateBriefingSafety(output, [resolvedAlert]);
  assert.equal(result.narrative, "All clear.");
  assert.equal(result.recommendation, "No action needed.");
});

test("guard catches payment-release language even without explicit clearance words", () => {
  const paymentOnlyOutput = {
    narrative: "Transaction 205740 is open and critical.",
    recommendation: "The payment can proceed and funds should be released.",
    tone: "critical",
  };
  const result = validateBriefingSafety(paymentOnlyOutput, [alert205740]);
  const text = `${result.narrative} ${result.recommendation}`.toLowerCase();
  assert.ok(!text.includes("release"), "fallback must not contain payment-release language");
  assert.ok(!text.includes("proceed"), "fallback must not contain payment-proceed language");
});

// ── Fabricated flag name detection ──────────────────────────────────────────
// The AI narrative must not mention risk flag names that do not exist in the
// source alerts' flag_reasons. The old briefing hallucinated "Personal Account
// on Corporate Invoice" for transaction 205740, but that flag was never
// generated by the rules engine (the invoice had no bank account data).
test("guard discards narrative that mentions a flag name not in source alert flag_reasons", () => {
  const alertWithOnlyHighValue = {
    ...alert205740,
    flag_reasons: ["High-value threshold exceeded (>50,000)"],
  };
  const fabricatedFlagOutput = {
    narrative:
      "Transaction 205740 is flagged. The transaction is associated with flags for High-value threshold exceeded and Personal Account on Corporate Invoice.",
    recommendation:
      "Recommend a compliance officer review the flagged details for transaction 205740.",
    tone: "critical",
  };
  const result = validateBriefingSafety(fabricatedFlagOutput, [alertWithOnlyHighValue]);
  const text = `${result.narrative} ${result.recommendation}`.toLowerCase();
  // The fabricated flag "personal account on corporate invoice" must NOT appear
  assert.ok(
    !text.includes("personal account on corporate invoice"),
    "narrative must not mention a flag name that is not in the source alert's flag_reasons"
  );
  // Should have fallen back to the safe briefing
  assert.equal(result.narrative, SAFE_FALLBACK_BRIEFING.narrative);
});

test("guard preserves narrative that only mentions flags present in source flag_reasons", () => {
  const alertWithHighValue = {
    ...alert205740,
    flag_reasons: ["High-value threshold exceeded (>50,000)"],
  };
  const cleanOutput = {
    narrative:
      "Transaction 205740 remains flagged and unresolved. The transaction is associated with the flag: High-value threshold exceeded.",
    recommendation:
      "Recommend a compliance officer review the flagged details for transaction 205740.",
    tone: "critical",
  };
  const result = validateBriefingSafety(cleanOutput, [alertWithHighValue]);
  assert.equal(result.narrative, cleanOutput.narrative);
  assert.equal(result.recommendation, cleanOutput.recommendation);
});