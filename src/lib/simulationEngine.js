import { computeRiskFactors } from "@/lib/dashboardAI";
import { base44 } from "@/api/base44Client";
import { convertAmount } from "@/lib/currencyUtils";

// Sum flagged-transaction exposure in a single base currency (USD) so mixed
// NGN/USD/GBP datasets never produce a meaningless aggregate. Falls back to the
// raw sum when rates are unavailable (legacy behavior).
function sumExposureUSD(txs, rates) {
  return txs.filter((t) => t.status === "flagged").reduce((s, t) => {
    const amt = Number(t.amount) || 0;
    return s + (rates ? convertAmount(amt, t.currency || "USD", "USD", rates) : amt);
  }, 0);
}

/**
 * Runs a what-if simulation by injecting hypothetical transactions
 * into the existing dataset and recomputing risk factors.
 *
 * @param {Array} existingTransactions - current real transactions
 * @param {Object} scenario - { vendorName, riskLevel, amount, category, location, transactionCount, paymentMethod }
 * @returns {Object} { baseline, projected, delta, newTransactions }
 */
export function runSimulation(existingTransactions, scenario, rates = null) {
  const {
    vendorName = "Hypothetical Vendor",
    riskLevel = "high",
    amount = 50000,
    category = "Procurement",
    location = "Lagos, NG",
    transactionCount = 5,
    paymentMethod = "Bank Transfer",
  } = scenario;

  // Generate hypothetical transactions
  const hypothetical = [];
  for (let i = 0; i < transactionCount; i++) {
    hypothetical.push({
      transaction_id: `SIM-${Date.now()}-${i}`,
      vendor: vendorName,
      amount: amount * (0.8 + Math.random() * 0.4),
      currency: "USD",
      category,
      location,
      payment_method: paymentMethod,
      status: i < Math.ceil(transactionCount * 0.3) ? "flagged" : "clean",
      risk_score: riskLevel === "critical" ? 85 + Math.random() * 15
        : riskLevel === "high" ? 60 + Math.random() * 20
        : riskLevel === "medium" ? 35 + Math.random() * 20
        : 10 + Math.random() * 20,
      risk_level: riskLevel,
      anomaly_flags: riskLevel === "critical" || riskLevel === "high" ? ["High-value threshold", "New vendor"] : [],
      created_date: new Date().toISOString(),
      transaction_date: new Date().toISOString().slice(0, 10),
    });
  }

  const combined = [...existingTransactions, ...hypothetical];

  const baselineFactors = computeRiskFactors(existingTransactions);
  const projectedFactors = computeRiskFactors(combined);

  const baseline = {
    composite: Math.round(baselineFactors.composite || 0),
    factors: baselineFactors.factors || [],
    totalTx: existingTransactions.length,
    flagged: existingTransactions.filter((t) => t.status === "flagged").length,
    exposure: sumExposureUSD(existingTransactions, rates),
  };

  const projected = {
    composite: Math.round(projectedFactors.composite || 0),
    factors: projectedFactors.factors || [],
    totalTx: combined.length,
    flagged: combined.filter((t) => t.status === "flagged").length,
    exposure: sumExposureUSD(combined, rates),
  };

  const delta = {
    composite: projected.composite - baseline.composite,
    exposure: projected.exposure - baseline.exposure,
    flagged: projected.flagged - baseline.flagged,
  };

  return { baseline, projected, delta, newTransactions: hypothetical };
}

/**
 * Generates AI commentary on the simulation result.
 */
export async function generateSimulationNarrative(scenario, result) {
  try {
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a risk analyst. A compliance team ran a what-if simulation with these parameters:
- Vendor: ${scenario.vendorName}
- Risk Level: ${scenario.riskLevel}
- Amount per transaction: $${scenario.amount?.toLocaleString()}
- Transaction count: ${scenario.transactionCount}
- Category: ${scenario.category}
- Location: ${scenario.location}

Results:
- Baseline composite risk score: ${result.baseline.composite}
- Projected composite risk score: ${result.projected.composite} (${result.delta.composite >= 0 ? "+" : ""}${result.delta.composite})
- Baseline exposure: $${result.baseline.exposure?.toLocaleString()}
- Projected exposure: $${result.projected.exposure?.toLocaleString()} (${result.delta.exposure >= 0 ? "+" : ""}$${result.delta.exposure?.toLocaleString()})
- Flagged transactions: ${result.baseline.flagged} → ${result.projected.flagged}

Provide a concise 3-sentence executive assessment: (1) the risk impact, (2) whether to proceed, (3) recommended mitigations. Be direct and professional.`,
    });
    return typeof res === "string" ? res : res?.answer || res?.response || "";
  } catch (e) {
    return "Unable to generate simulation narrative at this time.";
  }
}