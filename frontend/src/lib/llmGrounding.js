// Shared checks that keep model text inside the records it was given.

const CLEARANCE = /\b(cleared|clearance|whitelisted|whitelist|safe to pay|release payment|release funds|disburse|disbursement)\b/i;

export function hasClearanceLanguage(text) {
  return CLEARANCE.test(String(text || ""));
}

export function numericClaims(text) {
  const raw = String(text || "").match(/\d[\d,]*(?:\.\d+)?/g) || [];
  return raw
    .map((value) => value.replace(/,/g, ""))
    .filter((value) => value.includes(".") || value.length >= 2);
}

export function claimsAreGrounded(text, source) {
  if (hasClearanceLanguage(text)) return false;
  const hay = String(source || "").replace(/,/g, "");
  return numericClaims(text).every((value) => hay.includes(value));
}

export function listingContainsPrice(text, amount) {
  const target = Number(amount);
  if (!Number.isFinite(target) || target <= 0) return false;
  const source = String(text || "");
  const tokens = source.match(/\d[\d,]*(?:\.\d+)?/g) || [];
  return tokens.some((token) => {
    const value = Number(token.replace(/,/g, ""));
    if (!Number.isFinite(value) || value <= 0) return false;
    const tolerance = Math.max(1, Math.abs(target) * 0.01);
    return Math.abs(value - target) <= tolerance;
  });
}

export function groundSanctionsResult(result) {
  const output = result && typeof result === "object" ? result : {};
  return {
    match_status: "pending",
    confidence: 0,
    matched_list: "",
    risk_factors: Array.isArray(output.risk_factors) ? output.risk_factors.slice(0, 5) : [],
    recommended_action: "A compliance officer must check the official watchlist. This screen is not a clearance.",
    screening_notes: "No official watchlist record was retrieved. A model name-match is not a confirmed or cleared result.",
  };
}

export function groundSimilarCases(cases, allowedIds) {
  const allowed = new Set(allowedIds || []);
  return (cases || []).filter((item) => item && allowed.has(item.investigation_id)).slice(0, 3);
}

export function groundFinancialImpact(amount) {
  const known = Number(amount);
  const recorded = Number.isFinite(known) && known >= 0 ? known : 0;
  return {
    estimated_exposure: recorded,
    exposure_range_low: recorded,
    exposure_range_high: recorded,
    impact_category: recorded > 0 ? "moderate" : "minimal",
    factors: ["Exposure equals the recorded transaction amount. No extra loss was calculated."],
    mitigation_value: "No additional recovery or reputational amount was calculated from the model.",
  };
}
