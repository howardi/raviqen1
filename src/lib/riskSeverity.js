export function riskLevelFromScore(score) {
  const value = Number(score);
  if (!Number.isFinite(value)) return "low";
  if (value >= 75) return "critical";
  if (value >= 55) return "high";
  if (value >= 30) return "medium";
  return "low";
}

export function resolveRiskLevel(record = {}) {
  return Number.isFinite(Number(record.risk_score))
    ? riskLevelFromScore(record.risk_score)
    : ["low", "medium", "high", "critical"].includes(record.risk_level)
      ? record.risk_level
      : "low";
}

const severityRank = { low: 0, medium: 1, high: 2, critical: 3 };

export function highestRiskLevel(records = []) {
  return records.reduce((highest, record) => {
    const level = resolveRiskLevel(record);
    return severityRank[level] > severityRank[highest] ? level : highest;
  }, "low");
}