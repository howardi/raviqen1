// RAVIQEN Shared Aggregation Service — the single source of truth for every metric.
// Every dashboard, report, and export MUST route through computeMetrics() so numbers
// cannot drift apart across views. Metrics are deterministic queries over verified
// ingested records — never LLM-summarized or reasoned into existence.
//
// reconcileMetrics() compares a set of displayed values against a fresh recomputation
// and returns a per-metric integrity report. Any mismatch blocks that metric from
// display (the UI layer is responsible for suppressing discrepant metrics).

import { independentlyFilterByDate } from "@/lib/dataValidation";
import { convertAmount } from "@/lib/currencyUtils";

// Canonical metric computation from raw records. Pure function — no side effects,
// no LLM calls. Same inputs always yield the same outputs.
//
// totalExposure is computed in a single base currency (USD by default): each
// transaction's amount is converted from its native currency before summing, so
// mixing NGN + USD + GBP never produces a meaningless aggregate. Callers should
// pass live `rates` (from useCurrency) for an accurate figure.
export function computeMetrics(transactions = [], alerts = [], { timeRange = "all", scopeFilter = null, rates = null, baseCurrency = "USD" } = {}) {
  let tx = transactions;
  let al = alerts;
  if (scopeFilter) {
    tx = tx.filter(scopeFilter.txFilter || (() => true));
    al = al.filter(scopeFilter.alertFilter || (() => true));
  }
  tx = independentlyFilterByDate(tx, timeRange, ["created_date", "transaction_date"]);
  al = independentlyFilterByDate(al, timeRange, ["created_date"]);

  // ── SINGLE SOURCE OF TRUTH: Alert.status is the authoritative status field ──
  // Every metric that reflects "needs action" derives from Alert.status, not
  // Transaction.status. This ensures all four dashboard numbers (Total Exposure,
  // Open Alerts, Avg Risk Score, Critical count) move together from one field.
  // A transaction counts toward exposure/risk ONLY if it has a linked OPEN alert.
  const openAlertTxIds = new Set(
    al.filter((a) => a.status === "open").map((a) => a.transaction_id).filter(Boolean)
  );
  const exposureTx = tx.filter((t) => t.transaction_id && openAlertTxIds.has(t.transaction_id));

  // Sum in a single base currency. When rates are available each amount is
  // converted from its native currency first; without rates we fall back to the
  // raw sum so the function stays usable in isolation.
  const totalExposure = exposureTx.reduce(
    (s, t) => s + (rates ? convertAmount(Number(t.amount) || 0, t.currency || baseCurrency, baseCurrency, rates) : (Number(t.amount) || 0)),
    0
  );
  // Avg risk score is over transactions with OPEN alerts only — so it moves
  // in lockstep with exposure and open-alert count.
  const avgRiskScore = exposureTx.length
    ? exposureTx.reduce((s, t) => s + (Number(t.risk_score) || 0), 0) / exposureTx.length
    : 0;
  const openAlerts = al.filter((a) => a.status === "open").length;
  const criticalCount = al.filter((a) => a.status === "open" && a.risk_level === "critical").length;

  return {
    totalExposure: Math.round(totalExposure * 100) / 100,
    openAlerts,
    avgRiskScore: Math.round(avgRiskScore * 1000) / 1000,
    transactionsMonitored: tx.length,
    flaggedCount: exposureTx.length,
    criticalCount,
    // Provenance — every metric carries the query it came from.
    _source: {
      transactions: tx.length,
      alerts: al.length,
      timeRange,
      authoritativeStatusField: "Alert.status",
      computedAt: new Date().toISOString(),
    },
  };
}

const TOLERANCE = { totalExposure: 0.02, avgRiskScore: 0.05, openAlerts: 0, transactionsMonitored: 0 };

// Reconcile displayed metrics against a fresh canonical recomputation.
// Returns a per-metric pass/fail report. A metric that fails is "blocked" — the
// caller must suppress it from display until the underlying records are resolved.
export function reconcileMetrics(displayed = {}, transactions = [], alerts = [], opts = {}) {
  const verified = computeMetrics(transactions, alerts, opts);
  const keys = ["totalExposure", "openAlerts", "avgRiskScore", "transactionsMonitored"];
  const checks = keys.map((k) => {
    const d = Number(displayed[k]);
    const v = verified[k];
    const tol = TOLERANCE[k] ?? 0.01;
    const pass = Math.abs((isNaN(d) ? 0 : d) - v) <= tol;
    return {
      key: k,
      label: LABELS[k],
      displayed: isNaN(d) ? null : d,
      verified: v,
      pass,
      blocked: !pass,
    };
  });
  const discrepancies = checks.filter((c) => !c.pass);
  return {
    status: discrepancies.length === 0 ? "verified" : "discrepancy",
    checks,
    discrepancies,
    blockedMetrics: discrepancies.map((c) => c.key),
    verifiedAt: new Date().toISOString(),
    source: verified._source,
  };
}

const LABELS = {
  totalExposure: "Total Exposure",
  openAlerts: "Open Alerts",
  avgRiskScore: "Avg Risk Score",
  transactionsMonitored: "Transactions Monitored",
};