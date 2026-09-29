// Reject monetary figures that are not present in the current transaction snapshot
// or the separately identified aggregate exposure. Never silently rewrite an AI claim.
export function groundNarrativeAmounts(output, transactionAmounts, exposure, fallback) {
  const allowed = new Set([...transactionAmounts, exposure].filter(Boolean));
  const claims = `${output.narrative || ""} ${output.recommendation || ""}`.match(/(?:₦|\$|£|€)\s*-?[\d,]+(?:\.\d+)?/g) || [];
  return claims.every((claim) => allowed.has(claim.replace(/\s+/g, ""))) ? output : { ...fallback };
}