// Dashboard factor scores are assessments of observed evidence, not defaults.
// null means there is no valid basis for a score; never include it in the composite.
const UNSCORED = "Insufficient history to assess";
const DAY = 86400000;

function velocity(transactions) {
  const dated = transactions.map((t) => ({ ...t, date: Date.parse(t.transaction_date) }))
    .filter((t) => Number.isFinite(t.date));
  if (dated.length < 5) return { score: null, reason: UNSCORED + ` (${transactions.length} transaction${transactions.length === 1 ? "" : "s"} monitored, ${dated.length} with usable dates; at least 5 dated transactions required).` };
  const buckets = new Map();
  dated.forEach((t) => {
    const window = Math.floor(t.date / (30 * DAY));
    buckets.set(window, (buckets.get(window) || 0) + 1);
  });
  const windows = [...buckets.keys()].sort((a, b) => a - b);
  if (windows.length < 3) return { score: null, reason: "Insufficient history to assess (at least three 30-day windows required)." };
  const current = buckets.get(windows.at(-1));
  const baseline = windows.slice(0, -1).reduce((sum, window) => sum + buckets.get(window), 0) / (windows.length - 1);
  if (!baseline) return { score: null, reason: UNSCORED + " (no prior activity baseline)." };
  return {
    score: Math.min(100, Math.round(Math.max(0, current / baseline - 1) * 50)),
    reason: `${current} transactions in the latest 30-day window versus ${baseline.toFixed(1)} per earlier observed window (${dated.length} dated transactions).`,
  };
}

function geography(transactions) {
  const highRisk = new Set(["RU", "IR", "KP", "SY", "VE", "MM", "AF", "HIGH-RISK JURISDICTION"]);
  const match = transactions.find((t) => highRisk.has(String(t.location || "").trim().toUpperCase()));
  return match
    ? { score: 100, reason: `Transaction ${match.transaction_id}: recorded location “${match.location}” matches a configured high-risk jurisdiction.` }
    : { score: null, reason: "Not scored — no transaction location matches a configured high-risk jurisdiction; absence of a match is not proof of low risk." };
}

function counterparty(alerts) {
  const match = alerts.flatMap((alert) => (alert.flag_evidence || []).map((e) => ({ alert, evidence: e })))
    .find(({ evidence }) => evidence.rule_id === "RULE-RM-04" && evidence.evidence_field === "counterparty" && evidence.evidence_value && evidence.detail?.includes("ingesting organization"));
  return match
    ? { score: 100, reason: `Transaction ${match.alert.transaction_id}: ${match.evidence.detail}` }
    : { score: null, reason: "Not scored — no source-backed invoice recipient mismatch or other verified counterparty finding." };
}

export function computeRiskFactors(transactions = [], alerts = []) {
  const v = velocity(transactions);
  const g = geography(transactions);
  const c = counterparty(alerts);
  const factors = [
    { key: "velocity", label: "Transaction Velocity", ...v, weight: 25, color: "#3b82f6" },
    { key: "geographic", label: "Geographic Risk", ...g, weight: 30, color: "#ef4444" },
    { key: "currency", label: "Currency Volatility", score: null, reason: "Not scored — historical exchange-rate observations are unavailable; a non-USD currency alone is not volatility.", weight: 20, color: "#7c3aed" },
    { key: "counterparty", label: "Counterparty Risk", ...c, weight: 25, color: "#f97316" },
  ];
  const scored = factors.filter((f) => Number.isFinite(f.score) && f.reason);
  const activeWeight = scored.reduce((sum, f) => sum + f.weight, 0);
  return { factors, composite: activeWeight ? Math.round(scored.reduce((sum, f) => sum + f.score * f.weight, 0) / activeWeight) : null };
}