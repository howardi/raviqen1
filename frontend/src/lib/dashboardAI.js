import { base44 } from "@/api/base44Client";
import { formatCurrency } from "@/lib/currencyUtils";
import { validateBriefingSafety, SAFE_FALLBACK_BRIEFING } from "@/lib/briefingGuard";
import { groundNarrativeAmounts } from "@/lib/narrativeAmounts";
export { computeRiskFactors } from "@/lib/riskFactors";

const HIGH_RISK_LOCATIONS = ["RU", "IR", "KP", "SY", "VE", "MM", "AF", "High-risk jurisdiction", "high-risk"];

// 1. AI-generated executive risk narrative — grounded ONLY in live dashboard data.
// The generator is strictly read-only: it receives actual record fields and may not
// invent facts, classifications, or clearance status. A post-generation guard
// (validateBriefingSafety) discards any output containing clearance/resolution/
// payment language while any referenced alert is still open/flagged/critical,
// replacing it with a safe fallback.
export async function generateDashboardNarrative({ stats, topAlerts, anomalies, riskFactors, forecast, displayCurrency = "USD", exposureStr }) {
  const alertAmount = (a) => a.amount == null ? "Unavailable" : formatCurrency(a.amount, a.currency);

  // Build a strictly-factual snapshot of each top alert using ONLY its real fields.
  const alertFacts = (topAlerts || []).slice(0, 5).map((a, i) => ({
    index: i + 1,
    title: a.title || "Untitled alert",
    transaction_id: a.transaction_id || "N/A",
    vendor: a.vendor || "Unknown",
    amount: alertAmount(a),
    risk_score: a.risk_score ?? "N/A",
    risk_level: a.risk_level || "unknown",
    status: a.status || "unknown",
    flag_reasons: (a.flag_reasons || []).join("; ") || "None",
  }));

  const prompt = `You are RAVIQEN, an AI risk and compliance analyst. Generate a concise executive risk narrative for the dashboard.

STRICT GROUNDING RULES (violating any of these causes the output to be discarded):
1. You may ONLY state facts that are present in the data below. You may NOT invent, infer, or assume any fact, classification, status, or relationship that is not explicitly provided.
2. You may NOT classify a vendor's sector, industry, or entity type unless that classification is a literal field in the data below. If no sector field is present, you must NOT mention any sector.
3. You may NOT state that a vendor is "verified", "cleared", "whitelisted", or "approved" unless those exact words appear in the data below as a status field. If the data does not say so, you must NOT say so.
4. You may NOT use the phrases "cleared by logic", "verified business operations", "enterprise whitelist", "approved by contract", or any similar clearance language. These concepts do not exist in this system.
5. If ANY alert below has a status of "open", "investigating", or any non-resolved status, the narrative MUST explicitly state that the transaction remains flagged and unresolved. You may NOT use any language implying clearance, resolution, verification, or whitelisting for such alerts.
6. You may ONLY recommend that a human (e.g. a compliance officer) review specific items. You may NOT state that any review has already happened. You may NOT recommend finalizing a payment, releasing funds, disbursing, closing an alert, or changing any record status — those are irreversible actions requiring a logged human decision.
7. Do NOT recommend any automated or AI-initiated action. All recommendations must be framed as proposals for human review only.

Current period metrics (factual):
- Total transactions monitored: ${stats.totalTx}
- Flagged transactions: ${stats.flagged}
- Critical priority: ${stats.critical}
- Total exposure: ${exposureStr}
- Average risk score: ${stats.avgRisk.toFixed(1)}
- Open alerts: ${stats.openAlerts}

Top priority alerts (actual current fields — use EXACTLY these values):
${alertFacts.map((a) => `${a.index}. Title: "${a.title}" | Transaction: ${a.transaction_id} | Vendor: ${a.vendor} | Amount: ${a.amount} | Risk score: ${a.risk_score} | Risk level: ${a.risk_level} | Status: ${a.status} | Flag reasons: ${a.flag_reasons}`).join("\n") || "None"}

Detected anomalies (factual):
${(anomalies || []).slice(0, 5).map((a, i) => `${i + 1}. ${a.transaction_id} — ${a.reasons.join(", ")}, confidence ${a.confidence}%`).join("\n") || "None"}

Risk factor assessments (only scored factors contribute to the composite):
${(riskFactors || []).map((f) => `- ${f.label}: ${f.score == null ? "Not scored" : `${f.score}/100 (weight ${f.weight}%)`} — ${f.reason}`).join("\n")}

Forecast (factual):
- Projected flagged volume: ${forecast?.nextFlaggedVolume ?? "N/A"}
- Projected risk score: ${forecast?.nextRiskScore?.toFixed(1) ?? "N/A"}

Currency formatting (STRICT): Aggregate exposure is shown in ${displayCurrency}. Each individual transaction amount is provided above with its native symbol already applied. Reproduce that symbol EXACTLY as given. NEVER default to the '$' symbol for non-USD amounts. NEVER mix a symbol with an ISO code.

Write a 2-3 sentence executive risk narrative that states the current risk posture using ONLY the facts above, names the primary drivers (cite specific alert titles or transaction IDs verbatim), and recommends that a compliance officer review the specific open items. Do not speculate beyond the data. Do not imply any clearance, resolution, or payment action.`;

  const res = await base44.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: {
      type: "object",
      properties: {
        narrative: { type: "string" },
        recommendation: { type: "string" },
        tone: { type: "string", enum: ["stable", "elevated", "critical"] },
      },
    },
  });

  const parsed = typeof res === "string"
    ? { narrative: res, recommendation: "", tone: "elevated" }
    : res;

  // Post-generation safety guard: discard clearance/payment language while any
  // source alert is still open/flagged/critical.
  const safe = validateBriefingSafety(parsed, topAlerts || []);
  const grounded = groundNarrativeAmounts(safe, alertFacts.map((a) => a.amount), exposureStr, SAFE_FALLBACK_BRIEFING);
  const first = alertFacts.find((a) => a.amount !== "Unavailable" && a.transaction_id !== "N/A");
  return first ? { ...grounded, narrative: `${grounded.narrative} Transaction ${first.transaction_id} amount: ${first.amount}.` } : grounded;
}

// 2. Predictive forecast — linear regression projection on flagged-volume trend
export function forecastTrend(trendData, periods = 3) {
  const ys = (trendData || []).map((d) => d.flagged || 0);
  const n = ys.length;
  if (n === 0) return { projections: [], nextFlaggedVolume: 0, nextRiskScore: 0 };
  const xs = ys.map((_, i) => i);
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  const denom = xs.reduce((s, x) => s + (x - meanX) ** 2, 0) || 1;
  const slope = xs.reduce((s, x, i) => s + (x - meanX) * (ys[i] - meanY), 0) / denom;
  const intercept = meanY - slope * meanX;
  const projections = [];
  for (let i = 1; i <= periods; i++) {
    const val = Math.max(0, Math.round(intercept + slope * (n - 1 + i)));
    projections.push({ label: `+${i}d`, forecast: val });
  }
  const lastFlagged = ys[n - 1] || 0;
  const nextFlaggedVolume = projections[0]?.forecast || lastFlagged;
  const trend = slope >= 0 ? 1 : -1;
  const nextRiskScore = Math.min(
    100,
    Math.max(0, 50 + trend * Math.abs(slope) * 4 + (lastFlagged - meanY))
  );
  return {
    projections,
    nextFlaggedVolume,
    nextRiskScore: Math.round(nextRiskScore * 10) / 10,
    slope: Math.round(slope * 100) / 100,
  };
}

// 3. Anomaly detection — statistical deviation from normal behavior patterns
export function detectAnomalies(transactions) {
  if (!transactions || transactions.length < 3) return [];
  const amounts = transactions.map((t) => t.amount || 0);
  const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
  const variance = amounts.reduce((s, a) => s + (a - mean) ** 2, 0) / amounts.length;
  const std = Math.sqrt(variance) || 1;

  const vendorCounts = {};
  const locCounts = {};
  const currCounts = {};
  transactions.forEach((t) => {
    if (t.vendor) vendorCounts[t.vendor] = (vendorCounts[t.vendor] || 0) + 1;
    if (t.location) locCounts[t.location] = (locCounts[t.location] || 0) + 1;
    if (t.currency) currCounts[t.currency] = (currCounts[t.currency] || 0) + 1;
  });

  const anomalies = [];
  transactions.forEach((t) => {
    const reasons = [];
    let score = 0;

    // Amount deviation (z-score)
    const z = std ? Math.abs((t.amount - mean) / std) : 0;
    if (z > 2) {
      reasons.push(`Amount ${z.toFixed(1)}σ from mean`);
      score += z * 18;
    }

    // Vendor frequency — first transaction with this counterparty
    const vc = vendorCounts[t.vendor] || 1;
    if (vc === 1) {
      reasons.push("First transaction with vendor");
      score += 25;
    }

    // Geography — high-risk jurisdiction or rare location
    const lc = locCounts[t.location] || 0;
    const locFreq = lc / transactions.length;
    if (t.location && HIGH_RISK_LOCATIONS.some((h) => (t.location || "").includes(h))) {
      reasons.push("High-risk jurisdiction");
      score += 30;
    } else if (t.location && locFreq < 0.05) {
      reasons.push("Unusual geography");
      score += 18;
    }

    // Currency pairing rarity
    const cc = currCounts[t.currency] || 0;
    const currFreq = cc / transactions.length;
    if (t.currency && currFreq < 0.1 && Object.keys(currCounts).length > 1) {
      reasons.push("Rare currency pairing");
      score += 15;
    }

    if (reasons.length === 0) return;
    const confidence = Math.min(99, Math.round(score));
    anomalies.push({
      transaction_id: t.transaction_id,
      vendor: t.vendor,
      amount: t.amount,
      currency: t.currency,
      location: t.location,
      reasons,
      confidence,
      risk_level: t.risk_level,
    });
  });
  return anomalies.sort((a, b) => b.confidence - a.confidence).slice(0, 8);
}