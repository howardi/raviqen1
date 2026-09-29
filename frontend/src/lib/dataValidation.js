/**
 * Data Integrity Validation Layer
 *
 * Independently recomputes dashboard metrics from raw entity records
 * and cross-checks them against the values the dashboard displays.
 * Catches computation bugs, stale/optimistic state drift, and data
 * desynchronization with zero tolerance for hallucination.
 *
 * Every metric displayed on the dashboard MUST be verifiable against
 * its source records. If recomputation disagrees with the displayed
 * value, a discrepancy is flagged.
 */

import { base44 } from "@/api/base44Client";
import { convertAmount } from "@/lib/currencyUtils";

/**
 * Parse a date safely from multiple possible field names.
 */
function parseDate(record, fields) {
  for (const f of fields) {
    if (record[f]) {
      const d = new Date(record[f]);
      if (!isNaN(d.getTime())) return d;
    }
  }
  return null;
}

/**
 * Independent date-range filter — does NOT reuse the dashboard's filterByDateRange,
 * so a bug in one cannot hide a bug in the other.
 */
export function independentlyFilterByDate(records, timeRange, dateFields) {
  if (timeRange === "all") return records;
  const now = Date.now();
  const ranges = { "7d": 7, "30d": 30, "90d": 90 };
  const days = ranges[timeRange] || 30;
  const cutoff = now - days * 24 * 60 * 60 * 1000;
  return records.filter((r) => {
    const d = parseDate(r, dateFields);
    if (!d) return false;
    return d.getTime() >= cutoff;
  });
}

/**
 * Independently recompute the core dashboard metrics from raw entity records.
 * This is a separate, auditable implementation — not shared with the dashboard's
 * own computation — so it acts as a true cross-check.
 */
export function recomputeMetrics(rawTransactions, rawAlerts, timeRange, rates = null, baseCurrency = "USD") {
  const tx = independentlyFilterByDate(rawTransactions, timeRange, ["created_date", "transaction_date"]);
  const alerts = independentlyFilterByDate(rawAlerts, timeRange, ["created_date"]);

  // SINGLE SOURCE OF TRUTH: Alert.status drives all "needs action" metrics.
  // A transaction counts toward exposure/risk ONLY if it has a linked OPEN alert.
  const openAlertTxIds = new Set(
    alerts.filter((a) => a.status === "open").map((a) => a.transaction_id).filter(Boolean)
  );
  const actionTx = tx.filter((t) => t.transaction_id && openAlertTxIds.has(t.transaction_id));
  const critical = alerts.filter((a) => a.status === "open" && a.risk_level === "critical");
  // Sum exposure in a single base currency so the cross-check compares like with
  // like against computeMetrics (which now does the same). Without rates this
  // falls back to the raw sum, matching the legacy behavior.
  const exposure = actionTx.reduce(
    (sum, t) => sum + (rates ? convertAmount(Number(t.amount) || 0, t.currency || baseCurrency, baseCurrency, rates) : (Number(t.amount) || 0)),
    0
  );
  const avgRisk = actionTx.length
    ? actionTx.reduce((s, t) => s + (Number(t.risk_score) || 0), 0) / actionTx.length
    : 0;
  const openAlerts = alerts.filter((a) => a.status === "open").length;

  return {
    totalTx: tx.length,
    flagged: actionTx.length,
    critical: critical.length,
    exposure: Math.round(exposure * 100) / 100,
    avgRisk: Math.round(avgRisk * 1000) / 1000,
    openAlerts,
    _filteredTxCount: tx.length,
    _filteredAlertCount: alerts.length,
  };
}

/**
 * Compare two numeric values within a tolerance to avoid floating-point noise.
 */
function numbersMatch(a, b, tolerance = 0.01) {
  return Math.abs((Number(a) || 0) - (Number(b) || 0)) <= tolerance;
}

/**
 * Cross-check the dashboard's displayed stats against an independent recomputation.
 * Returns a validation report listing each metric as verified or discrepant.
 */
export function validateDashboardStats(displayedStats, rawTransactions, rawAlerts, timeRange, rates = null) {
  const verified = recomputeMetrics(rawTransactions, rawAlerts, timeRange, rates);
  const checks = [
    {
      key: "totalTx",
      label: "Transactions Monitored",
      displayed: displayedStats.totalTx,
      verified: verified.totalTx,
      pass: displayedStats.totalTx === verified.totalTx,
    },
    {
      key: "flagged",
      label: "Flagged Transactions",
      displayed: displayedStats.flagged,
      verified: verified.flagged,
      pass: displayedStats.flagged === verified.flagged,
    },
    {
      key: "critical",
      label: "Critical Priority",
      displayed: displayedStats.critical,
      verified: verified.critical,
      pass: displayedStats.critical === verified.critical,
    },
    {
      key: "exposure",
      label: "Total Exposure",
      displayed: Math.round((Number(displayedStats.exposure) || 0) * 100) / 100,
      verified: verified.exposure,
      pass: numbersMatch(displayedStats.exposure, verified.exposure, 0.02),
    },
    {
      key: "avgRisk",
      label: "Avg Risk Score",
      displayed: Math.round((Number(displayedStats.avgRisk) || 0) * 1000) / 1000,
      verified: verified.avgRisk,
      pass: numbersMatch(displayedStats.avgRisk, verified.avgRisk, 0.05),
    },
    {
      key: "openAlerts",
      label: "Open Alerts",
      displayed: displayedStats.openAlerts,
      verified: verified.openAlerts,
      pass: displayedStats.openAlerts === verified.openAlerts,
    },
  ];

  const discrepancies = checks.filter((c) => !c.pass);
  return {
    status: discrepancies.length === 0 ? "verified" : "discrepancy",
    checks,
    discrepancies,
    verifiedAt: new Date().toISOString(),
    sourceCounts: {
      rawTransactions: rawTransactions.length,
      rawAlerts: rawAlerts.length,
      filteredTransactions: verified._filteredTxCount,
      filteredAlerts: verified._filteredAlertCount,
    },
  };
}

/**
 * Verify that each alert displayed in the Priority Alerts list still exists
 * in the source records and its key fields (risk_score, status, risk_level)
 * have not drifted since the dashboard rendered.
 */
export function validateAlertIntegrity(displayedAlerts, sourceAlerts) {
  const sourceMap = new Map(sourceAlerts.map((a) => [a.id, a]));
  return displayedAlerts.map((displayed) => {
    const source = sourceMap.get(displayed.id);
    if (!source) {
      return {
        id: displayed.id,
        status: "missing",
        label: displayed.title || displayed.id,
        issues: ["Alert no longer exists in source records"],
      };
    }
    const issues = [];
    if (Number(displayed.risk_score) !== Number(source.risk_score)) {
      issues.push(`risk_score: displayed ${displayed.risk_score} vs source ${source.risk_score}`);
    }
    if (displayed.status !== source.status) {
      issues.push(`status: displayed "${displayed.status}" vs source "${source.status}"`);
    }
    if (displayed.risk_level !== source.risk_level) {
      issues.push(`risk_level: displayed "${displayed.risk_level}" vs source "${source.risk_level}"`);
    }
    return {
      id: displayed.id,
      status: issues.length === 0 ? "verified" : "drifted",
      label: displayed.title || displayed.id,
      issues,
    };
  });
}

/**
 * Verify that each transaction in the Critical Summary still exists in source
 * records and its risk_level / status have not drifted.
 */
export function validateCriticalIntegrity(displayedCritical, sourceTransactions) {
  const sourceMap = new Map(sourceTransactions.map((t) => [t.id, t]));
  return displayedCritical.map((displayed) => {
    const source = sourceMap.get(displayed.id);
    if (!source) {
      return {
        id: displayed.id,
        status: "missing",
        label: displayed.vendor || displayed.transaction_id || displayed.id,
        issues: ["Transaction no longer exists in source records"],
      };
    }
    const issues = [];
    if (displayed.risk_level !== source.risk_level) {
      issues.push(`risk_level: displayed "${displayed.risk_level}" vs source "${source.risk_level}"`);
    }
    if (displayed.status !== source.status) {
      issues.push(`status: displayed "${displayed.status}" vs source "${source.status}"`);
    }
    if (!numbersMatch(displayed.amount, source.amount, 0.01)) {
      issues.push(`amount: displayed ${displayed.amount} vs source ${source.amount}`);
    }
    return {
      id: displayed.id,
      status: issues.length === 0 ? "verified" : "drifted",
      label: displayed.vendor || displayed.transaction_id || displayed.id,
      issues,
    };
  });
}

/**
 * Full validation pass: fetches fresh source records and validates the
 * dashboard's displayed stats, critical transactions, and top alerts.
 */
export async function runDataIntegrityCheck({
  displayedStats,
  displayedCritical,
  displayedAlerts,
  timeRange,
  scopeFilter,
  rates = null,
}) {
  const [rawTransactions, rawAlerts] = await Promise.all([
    base44.entities.Transaction.list("-created_date", 100),
    base44.entities.Alert.list("-created_date", 50),
  ]);

  // Apply the same role-based scoping the dashboard uses
  let scopedTx = rawTransactions;
  let scopedAlerts = rawAlerts;
  if (scopeFilter) {
    scopedTx = rawTransactions.filter(scopeFilter.txFilter);
    scopedAlerts = rawAlerts.filter(scopeFilter.alertFilter);
  }

  const statsValidation = validateDashboardStats(displayedStats, scopedTx, scopedAlerts, timeRange, rates);
  const criticalValidation = displayedCritical?.length
    ? validateCriticalIntegrity(displayedCritical, scopedTx)
    : [];
  const alertValidation = displayedAlerts?.length
    ? validateAlertIntegrity(displayedAlerts, scopedAlerts)
    : [];

  const allIssues = [
    ...statsValidation.discrepancies.map((d) => `${d.label}: displayed ${d.displayed} vs verified ${d.verified}`),
    ...criticalValidation.filter((c) => c.status !== "verified").map((c) => `Critical tx "${c.label}": ${c.issues.join("; ")}`),
    ...alertValidation.filter((a) => a.status !== "verified").map((a) => `Alert "${a.label}": ${a.issues.join("; ")}`),
  ];

  return {
    status: allIssues.length === 0 ? "verified" : "discrepancy",
    statsValidation,
    criticalValidation,
    alertValidation,
    issues: allIssues,
    verifiedAt: new Date().toISOString(),
    sourceCounts: statsValidation.sourceCounts,
  };
}