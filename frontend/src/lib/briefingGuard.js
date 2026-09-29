// RAVIQEN AI Risk Briefing — Post-Generation Safety Guard
//
// The briefing generator is strictly read/generate-text-only. It has ZERO write
// access to transaction status, audit logs, or payment workflows. This module
// enforces that the generated text can never fabricate compliance clearances,
// verification status, or payment-release recommendations for records that are
// still open/flagged/critical.
//
// Pure module: no external imports, safe to run in Node's test runner.

// Known risk flag names from the RAVIQEN rules engine. If the AI narrative
// mentions any of these but the source alerts do not contain that flag in
// their flag_reasons, the narrative is fabricating a flag and must be discarded.
const KNOWN_FLAG_NAMES = [
  "personal account on corporate invoice",
  "personal wallet account on corporate invoice",
  "high-value outlier with non-standard terms",
  "standard baseline — settled receipt",
  "invoice recipient mismatch",
  "first-time vendor",
  "first-time counterparty pairing",
  "high-value threshold exceeded",
  "duplicate transaction identifier",
  "weekend transaction",
  "off-hours submission",
  "amount deviation anomaly",
  "potential bec",
  "ghost entity",
  "price gouging",
  "price inflation",
  "severe price gouging",
  "missing required fields",
];

// Phrases that imply clearance, resolution, verification, or payment release.
// Forbidden while any referenced record is NOT resolved.
const FORBIDDEN_CLEARANCE_PHRASES = [
  "cleared by logic",
  "cleared",
  "clearance",
  "verified entity",
  "verified enterprise",
  "whitelist",
  "whitelisted",
  "approved by contract",
  "approved_by_contract",
  "resolved",
  "false positive",
  "false-positive",
  "finalize payment",
  "finalise payment",
  "release payment",
  "release funds",
  "disburse",
  "disbursement",
  "approve payment",
  "approve disbursement",
  "close alert",
  "close the alert",
  "mark as resolved",
  "mark as clean",
  "update the audit log to reflect cleared",
  "payment can proceed",
  "safe to pay",
  "safe to disburse",
];

// Fallback shown when the LLM output fails the safety guard. Explicitly states
// the transaction remains flagged, forbids automated action, and recommends
// human review only. Wording avoids every forbidden phrase below so the guard
// never rejects its own fallback.
export const SAFE_FALLBACK_BRIEFING = {
  narrative:
    "One or more transactions remain flagged and unresolved. No automated or payment action should be taken. A compliance officer must review the open alerts before any further action.",
  recommendation:
    "Recommend a compliance officer review the open flagged alerts and supporting evidence before any further action.",
  tone: "critical",
};

const RESOLVED_STATUSES = ["resolved", "closed_false_positive", "dismissed"];

/**
 * Post-generation safety guard. Scans the generated narrative + recommendation
 * for clearance / resolution / verification / payment-release language. If any
 * source alert is NOT resolved and forbidden language is present, the output is
 * discarded and a safe fallback is returned instead.
 *
 * @param {{narrative?: string, recommendation?: string, tone?: string}|null|undefined} output
 * @param {Array<{status?: string}>} sourceAlerts
 * @returns {{narrative: string, recommendation: string, tone: string}}
 */
export function validateBriefingSafety(output, sourceAlerts = []) {
  const hasUnresolved = (sourceAlerts || []).some(
    (a) => a && a.status && !RESOLVED_STATUSES.includes(a.status)
  );

  if (!output) return { ...SAFE_FALLBACK_BRIEFING };

  // Collect all flag_reasons from source alerts — these are the ONLY flags
  // the narrative is allowed to mention by name.
  const allowedFlags = new Set();
  for (const a of sourceAlerts || []) {
    for (const fr of a?.flag_reasons || []) {
      allowedFlags.add(fr.toLowerCase());
    }
  }

  const text = `${output.narrative || ""} ${output.recommendation || ""}`;
  const textLower = text.toLowerCase();

  // CHECK 1: Fabricated flag names — if the narrative mentions a known risk
  // flag name that does NOT appear in any source alert's flag_reasons, the
  // LLM is hallucinating a flag. Discard and use the safe fallback.
  // A known flag name is considered "allowed" if any source flag_reason
  // contains it as a substring (handles qualifiers like "(>50,000)").
  const fabricatedFlag = KNOWN_FLAG_NAMES.find((flagName) => {
    const isAllowed = [...allowedFlags].some((af) => af.includes(flagName) || flagName.includes(af));
    if (isAllowed) return false;
    return textLower.includes(flagName);
  });
  if (fabricatedFlag) {
    return { ...SAFE_FALLBACK_BRIEFING };
  }

  // If everything is resolved, no clearance restriction applies.
  if (!hasUnresolved) return output;

  // CHECK 2: Clearance / payment language while alerts are unresolved.
  // Word-boundary matching so "resolved" does NOT match inside "unresolved".
  const violation = FORBIDDEN_CLEARANCE_PHRASES.find((p) => {
    const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escaped}\\b`, "i").test(text);
  });

  if (violation) {
    return { ...SAFE_FALLBACK_BRIEFING };
  }
  return output;
}