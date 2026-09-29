import { base44 } from "@/api/base44Client";

// FX Volatility Stress Testing — simulates currency exchange rate shocks on transaction exposure

const BASE_CURRENCY = "USD";

// Approximate FX rates relative to USD (static baseline for simulation)
const BASE_FX_RATES = {
  USD: 1.0,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 149.5,
  CNY: 7.24,
  INR: 83.1,
  NGN: 1600,
  AED: 3.67,
  CAD: 1.36,
  AUD: 1.52,
  CHF: 0.88,
  SGD: 1.34,
  ZAR: 18.7,
  BRL: 5.05,
};

export const STRESS_SCENARIOS = [
  {
    id: "mild_depreciation",
    label: "Mild Depreciation (5%)",
    description: "Moderate currency weakening across emerging markets",
    shocks: { NGN: 5, INR: 3, BRL: 4, ZAR: 5, CNY: 2 },
    severity: "low",
  },
  {
    id: "emerging_crisis",
    label: "Emerging Market Crisis (15%)",
    description: "Sharp devaluation in emerging market currencies",
    shocks: { NGN: 15, INR: 10, BRL: 12, ZAR: 14, CNY: 6, TRY: 20 },
    severity: "high",
  },
  {
    id: "global_recession",
    label: "Global Recession (10%)",
    description: "Broad-based currency depreciation against USD",
    shocks: { EUR: 8, GBP: 7, JPY: 10, CNY: 8, INR: 10, NGN: 12, BRL: 10, ZAR: 12, AUD: 12, CAD: 8 },
    severity: "high",
  },
  {
    id: "currency_crisis",
    label: "Severe Currency Crisis (25%)",
    description: "Extreme devaluation event across all non-USD currencies",
    shocks: { EUR: 15, GBP: 15, JPY: 25, CNY: 20, INR: 25, NGN: 40, BRL: 25, ZAR: 30, AUD: 20, CAD: 15, CHF: 8, SGD: 15 },
    severity: "critical",
  },
  {
    id: "eurozone_breakup",
    label: "Eurozone Stress (12%)",
    description: "Euro-specific stress scenario",
    shocks: { EUR: 12, GBP: 5, CHF: 3, SGD: 5 },
    severity: "medium",
  },
];

export function computeExposureByCurrency(transactions) {
  const exposure = {};
  (transactions || []).forEach((t) => {
    const curr = t.currency || BASE_CURRENCY;
    if (!exposure[curr]) exposure[curr] = { currency: curr, count: 0, total: 0, flagged: 0 };
    exposure[curr].count++;
    exposure[curr].total += t.amount || 0;
    if (t.status === "flagged") exposure[curr].flagged++;
  });
  return Object.values(exposure).sort((a, b) => b.total - a.total);
}

export function runStressTest(transactions, scenario) {
  const exposureByCurrency = computeExposureByCurrency(transactions);
  const shocks = scenario.shocks || {};

  let baselineExposureUSD = 0;
  let stressedExposureUSD = 0;
  const currencyImpacts = [];

  exposureByCurrency.forEach((exp) => {
    const curr = exp.currency;
    const baseRate = BASE_FX_RATES[curr] || 1;
    const shockPct = shocks[curr] || 0;
    const stressedRate = curr === BASE_CURRENCY ? baseRate : baseRate * (1 + shockPct / 100);

    // Convert to USD: amount in foreign currency / rate = USD equivalent
    const baselineUSD = curr === BASE_CURRENCY ? exp.total : exp.total / baseRate;
    const stressedUSD = curr === BASE_CURRENCY ? exp.total : exp.total / stressedRate;

    // When foreign currency depreciates, it takes more of it to equal USD,
    // so USD-equivalent exposure decreases — but if we OWE in that currency, loss increases
    // For risk monitoring: stressed exposure in local currency terms (what we hold)
    const impactUSD = stressedUSD - baselineUSD;
    const impactPct = baselineUSD > 0 ? (impactUSD / baselineUSD) * 100 : 0;

    baselineExposureUSD += baselineUSD;
    stressedExposureUSD += stressedUSD;

    currencyImpacts.push({
      currency: curr,
      baseline_exposure: exp.total,
      baseline_exposure_usd: baselineUSD,
      stressed_exposure_usd: stressedUSD,
      shock_pct: shockPct,
      impact_usd: impactUSD,
      impact_pct: impactPct,
      transaction_count: exp.count,
      flagged_count: exp.flagged,
    });
  });

  const totalImpactUSD = stressedExposureUSD - baselineExposureUSD;
  const totalImpactPct = baselineExposureUSD > 0 ? (totalImpactUSD / baselineExposureUSD) * 100 : 0;

  // Risk score increase based on exposure concentration and shock severity
  const maxShock = Math.max(...Object.values(shocks), 0);
  const concentrationRisk = exposureByCurrency.length > 0
    ? (exposureByCurrency[0].total / (exposureByCurrency.reduce((s, e) => s + e.total, 0) || 1)) * 100
    : 0;
  const riskScoreIncrease = Math.round(maxShock * 0.3 + concentrationRisk * 0.2);

  return {
    scenario,
    baseline_exposure_usd: baselineExposureUSD,
    stressed_exposure_usd: stressedExposureUSD,
    total_impact_usd: totalImpactUSD,
    total_impact_pct: totalImpactPct,
    risk_score_increase: riskScoreIncrease,
    currency_impacts: currencyImpacts.sort((a, b) => Math.abs(b.impact_usd) - Math.abs(a.impact_usd)),
    exposure_by_currency: exposureByCurrency,
  };
}

export async function generateStressTestNarrative({ scenario, result, transactions }) {
  const prompt = `You are an FX risk analyst. Generate a concise stress test impact assessment for the following scenario:

Scenario: ${scenario.label}
Description: ${scenario.description}
Severity: ${scenario.severity}

Baseline Total Exposure (USD): $${(result.baseline_exposure_usd || 0).toLocaleString()}
Stressed Total Exposure (USD): $${(result.stressed_exposure_usd || 0).toLocaleString()}
Total Impact: $${(result.total_impact_usd || 0).toLocaleString()} (${(result.total_impact_pct || 0).toFixed(1)}%)
Risk Score Increase: +${result.risk_score_increase} points

Most Affected Currencies:
${(result.currency_impacts || []).slice(0, 5).map((c) => `- ${c.currency}: ${c.shock_pct}% shock, $${Math.abs(c.impact_usd).toLocaleString()} impact (${c.impact_pct.toFixed(1)}%)`).join("\n") || "None"}

Total Transactions: ${(transactions || []).length}

Write a 2-3 sentence assessment of the portfolio's resilience under this scenario, identify the most vulnerable exposure points, and recommend one hedging or mitigation action. Professional financial tone.`;

  const res = await base44.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: {
      type: "object",
      properties: {
        assessment: { type: "string" },
        resilience_rating: { type: "string", enum: ["strong", "adequate", "vulnerable", "critical"] },
        recommendation: { type: "string" },
      },
    },
  });

  return typeof res === "string" ? { assessment: res, resilience_rating: "vulnerable", recommendation: "" } : res;
}