// Sustainability scoring engine for supply chain compliance
// Evaluates carbon footprint, environmental impact, and fair labor practices

export function calculateSustainabilityScore(assessment) {
  const {
    carbon_footprint_tons = 0,
    energy_source_renewable_pct = 0,
    water_usage_liters = 0,
    waste_recycled_pct = 0,
    fair_labor_score = 0,
    child_labor_risk = "none",
    wage_compliance = "unknown",
    working_hours_compliance = "unknown",
    safety_score = 0,
  } = assessment;

  // Environmental score (0-100): lower carbon = better, higher renewable = better
  // Carbon benchmark: <100 tons = excellent, >10000 tons = poor
  const carbonScore = Math.max(0, Math.min(100, 100 - (carbon_footprint_tons / 100)));
  const renewableScore = energy_source_renewable_pct;
  const wasteScore = waste_recycled_pct;
  // Water usage benchmark: <1M liters = good, >10M = poor
  const waterScore = Math.max(0, Math.min(100, 100 - (water_usage_liters / 100000)));

  const environmentalScore = Math.round(
    (carbonScore * 0.35) + (renewableScore * 0.25) + (wasteScore * 0.2) + (waterScore * 0.2)
  );

  // Fair labor score (0-100)
  const childLaborPenalty = {
    none: 0, low: 15, moderate: 35, high: 60, severe: 100,
  };
  const wagePenalty = {
    compliant: 0, partial: 20, non_compliant: 50, unknown: 10,
  };
  const hoursPenalty = {
    compliant: 0, partial: 20, non_compliant: 50, unknown: 10,
  };

  const laborDeduction =
    (childLaborPenalty[child_labor_risk] || 0) +
    (wagePenalty[wage_compliance] || 0) +
    (hoursPenalty[working_hours_compliance] || 0);

  const laborScore = Math.max(0, Math.min(100, Math.round(
    (fair_labor_score * 0.4) + (safety_score * 0.3) + (Math.max(0, 100 - laborDeduction) * 0.3)
  )));

  // Overall: 55% labor + 45% environmental (labor weighted higher for humanitarian focus)
  const overallScore = Math.round((laborScore * 0.55) + (environmentalScore * 0.45));

  const grade =
    overallScore >= 85 ? "A" :
    overallScore >= 70 ? "B" :
    overallScore >= 55 ? "C" :
    overallScore >= 40 ? "D" : "F";

  const flagReasons = [];
  if (child_labor_risk === "high" || child_labor_risk === "severe") flagReasons.push("Critical: Child labor risk detected");
  if (wage_compliance === "non_compliant") flagReasons.push("Living wage non-compliance");
  if (working_hours_compliance === "non_compliant") flagReasons.push("Working hours violation");
  if (carbon_footprint_tons > 5000) flagReasons.push("High carbon footprint");
  if (energy_source_renewable_pct < 20) flagReasons.push("Low renewable energy usage");
  if (safety_score < 40) flagReasons.push("Poor workplace safety score");
  if (waste_recycled_pct < 10) flagReasons.push("Minimal waste recycling");

  return {
    environmental_impact_score: environmentalScore,
    overall_sustainability_score: overallScore,
    sustainability_grade: grade,
    flag_reasons: flagReasons,
    labor_breakdown: { fairLabor: fair_labor_score, safety: safety_score, deductions: laborDeduction },
  };
}