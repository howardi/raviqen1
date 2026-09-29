import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import {
  ShieldAlert, DollarSign, FileSearch, Activity, ArrowUpRight, Upload, Sparkles,
  FileText, FileSpreadsheet, FileJson, Info,
} from "lucide-react";
import StatCard from "@/components/StatCard";
import AlertCard from "@/components/AlertCard";
import { RiskTrendChart, RiskDistributionChart } from "@/components/Charts";
import { RiskScoreRing } from "@/components/RiskBadge";
import RiskNarrative from "@/components/dashboard/RiskNarrative";
import CriticalSummary from "@/components/dashboard/CriticalSummary";
import AnomalyPanel from "@/components/dashboard/AnomalyPanel";
import RiskFactorsChart from "@/components/dashboard/RiskFactorsChart";
import {
  generateDashboardNarrative, forecastTrend, detectAnomalies, computeRiskFactors,
} from "@/lib/dashboardAI";
import CurrencySelector from "@/components/CurrencySelector";
import { useCurrency } from "@/lib/CurrencyContext";
import { convertAmount, formatCompact, formatCurrency } from "@/lib/currencyUtils";
import { useAuth } from "@/lib/AuthContext";
import { normalizeUserRole, isAdminRole, getRoleLabel } from "@/lib/permissions";
import { logActivity } from "@/lib/activityLogger";
import BackToTop from "@/components/BackToTop";
import EmptyState from "@/components/EmptyState";
import HighRiskAlertBanner from "@/components/HighRiskAlertBanner";
import QuickActions from "@/components/dashboard/QuickActions";
import ActivityFeed from "@/components/dashboard/ActivityFeed";
import NotificationBell from "@/components/NotificationBell";
import TimeRangeSelector, { filterByDateRange, buildTrendData } from "@/components/TimeRangeSelector";
import DataIntegrityPanel from "@/components/dashboard/DataIntegrityPanel";
import WeatherClock from "@/components/dashboard/WeatherClock";
import { isOversightManagerRole, OVERSIGHT_HERO } from "@/lib/oversight";
import OnboardingTour from "@/components/dashboard/OnboardingTour";
import { runDataIntegrityCheck } from "@/lib/dataValidation";
import { computeMetrics } from "@/lib/aggregationService";
import { highestRiskLevel } from "@/lib/riskSeverity";

export default function Dashboard() {
  const [alerts, setAlerts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  const [narrative, setNarrative] = useState(null);
  const [narrativeLoading, setNarrativeLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("30d");
  const [integrityValidation, setIntegrityValidation] = useState(null);
  const [integrityLoading, setIntegrityLoading] = useState(false);

  const { displayCurrency, rates } = useCurrency();
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = normalizeUserRole(user);
  const isAdmin = isAdminRole(role);

  // Time-based dynamic greeting based on user's local system time
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "Good morning";
    if (hour >= 12 && hour < 17) return "Good afternoon";
    return "Good evening";
  }, []);
  const userFirstName = useMemo(() => {
    const name = user?.full_name || (user?.email ? user.email.split("@")[0].replace(/[._]/g, " ") : "there");
    return name.split(" ")[0].charAt(0).toUpperCase() + name.split(" ")[0].slice(1);
  }, [user]);

  const handleInvestigate = async (tx) => {
    try {
      const inv = await base44.entities.Investigation.create({
        title: `High-risk investigation: ${tx.vendor}`,
        transaction_id: tx.transaction_id,
        vendor: tx.vendor,
        status: "open",
        risk_level: tx.risk_level,
      });
      await logActivity(user, "create_investigation", `Created investigation: ${inv.title} for transaction ${tx.transaction_id}`, "Investigation", inv.id);
      navigate(`/investigations/${inv.id}`);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteTransaction = async (tx) => {
    try {
      await base44.entities.Transaction.delete(tx.id);
      await logActivity(user, "delete_transaction", `Deleted transaction ${tx.transaction_id} (${tx.vendor}, ${formatCurrency(tx.amount, tx.currency)})`, "Transaction", tx.id);
      setTransactions((prev) => prev.filter((t) => t.id !== tx.id));
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const [alertData, txData] = await Promise.all([
          base44.entities.Alert.list("-created_date", 50),
          base44.entities.Transaction.list("-created_date", 100),
        ]);
        if (isAdmin) {
          setAlerts(alertData);
          setTransactions(txData);
        } else {
          const myTx = txData.filter((t) => t.created_by_id === user?.id);
          const myTxIds = new Set(myTx.map((t) => t.transaction_id));
          const myAlerts = alertData.filter(
            (a) => myTxIds.has(a.transaction_id) || a.assigned_to === user?.full_name || a.created_by_id === user?.id
          );
          setAlerts(myAlerts);
          setTransactions(myTx);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filteredTransactions = useMemo(
    () => filterByDateRange(transactions, timeRange, ["created_date", "transaction_date"]),
    [transactions, timeRange]
  );
  const filteredAlerts = useMemo(
    () => filterByDateRange(alerts, timeRange, ["created_date"]),
    [alerts, timeRange]
  );

  // Canonical metrics flow through the shared aggregation service (single source of
  // truth) so dashboards, reports, and exports can never drift apart. The integrity
  // check below independently recomputes from the same records and cross-checks.
  const metrics = useMemo(
    () => computeMetrics(transactions, alerts, { timeRange, rates }),
    [transactions, alerts, timeRange, rates]
  );
  const stats = useMemo(() => ({
    totalTx: metrics.transactionsMonitored,
    flagged: metrics.flaggedCount,
    critical: metrics.criticalCount,
    exposure: metrics.totalExposure,
    avgRisk: metrics.avgRiskScore,
    openAlerts: metrics.openAlerts,
  }), [metrics]);

  const trendData = useMemo(() => buildTrendData(filteredTransactions, timeRange), [filteredTransactions, timeRange]);

  const distData = useMemo(() => {
    const catCounts = {};
    filteredTransactions.forEach((t) => {
      const cat = t.category || "Other";
      catCounts[cat] = (catCounts[cat] || 0) + 1;
    });
    const sorted = Object.entries(catCounts)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
    return sorted.length ? sorted.slice(0, 5) : [{ label: "No data", count: 0 }];
  }, [filteredTransactions]);

  const topAlerts = useMemo(
    () =>
      [...filteredAlerts]
        .sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0))
        .slice(0, 5),
    [filteredAlerts]
  );
  const narrativeSeverity = useMemo(
    () => highestRiskLevel(filteredAlerts.filter((alert) => alert.status === "open")),
    [filteredAlerts]
  );

  // Transactions linked to OPEN alerts — the single authoritative status field
  // (Alert.status) determines which transactions need action. CriticalSummary
  // reads from this set so it can never disagree with the stat cards or banner.
  const openAlertTxIds = useMemo(
    () => new Set(filteredAlerts.filter((a) => a.status === "open").map((a) => a.transaction_id)),
    [filteredAlerts]
  );
  const criticalActionTx = useMemo(
    () => filteredTransactions
      .filter((t) => t.transaction_id && openAlertTxIds.has(t.transaction_id) && (t.risk_level === "critical" || t.risk_level === "high"))
      .sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0))
      .slice(0, 5),
    [filteredTransactions, openAlertTxIds]
  );

  const hasNoData = !loading && transactions.length === 0 && alerts.length === 0;

  const anomalies = useMemo(() => detectAnomalies(filteredTransactions), [filteredTransactions]);
  const riskFactors = useMemo(() => computeRiskFactors(filteredTransactions, filteredAlerts), [filteredTransactions, filteredAlerts]);
  const forecast = useMemo(() => forecastTrend(trendData, 3), [trendData]);

  // Trend chart data with dotted projection appended (forecast anchored to last actual point)
  const trendDataWithProjection = useMemo(() => {
    if (!trendData.length) return [];
    const last = trendData[trendData.length - 1];
    const anchor = { ...last, forecast: last.flagged };
    const proj = (forecast.projections || []).map((p) => ({ label: p.label, forecast: p.forecast }));
    return [...trendData, anchor, ...proj];
  }, [trendData, forecast]);

  // Auto-generate AI narrative once underlying data is loaded
  const runNarrative = async () => {
    setNarrativeLoading(true);
    try {
      // Refresh reads the same Transaction rows as the Critical Action card.
      // Do not feed the model Alert.amount or a USD round-trip of a native amount.
      const [latestTx, latestAlerts] = await Promise.all([
        base44.entities.Transaction.list("-created_date", 100),
        base44.entities.Alert.list("-created_date", 50),
      ]);
      const visibleTx = isAdmin ? latestTx : latestTx.filter((t) => t.created_by_id === user?.id);
      const visibleAlerts = isAdmin ? latestAlerts : latestAlerts.filter((a) =>
        visibleTx.some((t) => t.transaction_id === a.transaction_id) || a.assigned_to === user?.full_name || a.created_by_id === user?.id
      );
      setTransactions(visibleTx);
      setAlerts(visibleAlerts);
      const currentTx = filterByDateRange(visibleTx, timeRange, ["created_date", "transaction_date"]);
      const currentAlerts = filterByDateRange(visibleAlerts, timeRange, ["created_date"]);
      const txById = new Map(currentTx.map((t) => [t.transaction_id, t]));
      const currentTop = [...currentAlerts].sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0)).slice(0, 5)
        .map((a) => ({ ...a, amount: txById.get(a.transaction_id)?.amount ?? null, currency: txById.get(a.transaction_id)?.currency ?? null }));
      const currentMetrics = computeMetrics(visibleTx, visibleAlerts, { timeRange, rates, baseCurrency: displayCurrency });
      const res = await generateDashboardNarrative({
        stats: { ...stats, exposure: currentMetrics.totalExposure },
        topAlerts: currentTop,
        anomalies: detectAnomalies(currentTx), riskFactors: computeRiskFactors(currentTx, currentAlerts).factors,
        forecast: forecastTrend(buildTrendData(currentTx, timeRange), 3), displayCurrency,
        exposureStr: formatCurrency(currentMetrics.totalExposure, displayCurrency),
      });
      setNarrative(res);
    } catch (e) {
      setNarrative({ narrative: "Unable to generate risk briefing at this time.", recommendation: "", tone: "elevated" });
    } finally {
      setNarrativeLoading(false);
    }
  };

  useEffect(() => {
    if (!loading && filteredTransactions.length) runNarrative();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, filteredTransactions.length, timeRange]);

  // Data Integrity Validation — independently re-fetches source records and
  // cross-checks every displayed metric against a fresh recomputation.
  const runIntegrityCheck = useCallback(async () => {
    setIntegrityLoading(true);
    try {
      const scopeFilter = !isAdmin
        ? {
            txFilter: (t) => t.created_by_id === user?.id,
            alertFilter: (a) =>
              a.created_by_id === user?.id || a.assigned_to === user?.full_name,
          }
        : null;

      const criticalTx = filteredTransactions
        .filter((t) => t.status === "flagged" && (t.risk_level === "critical" || t.risk_level === "high"))
        .slice(0, 5);

      const result = await runDataIntegrityCheck({
        displayedStats: stats,
        displayedCritical: criticalTx,
        displayedAlerts: topAlerts,
        timeRange,
        scopeFilter,
        rates,
      });
      setIntegrityValidation(result);
    } catch (e) {
      setIntegrityValidation({
        status: "discrepancy",
        issues: ["Integrity check failed to execute: " + (e.message || "unknown error")],
        verifiedAt: new Date().toISOString(),
        statsValidation: { checks: [], discrepancies: [], sourceCounts: null },
      });
    } finally {
      setIntegrityLoading(false);
    }
  }, [stats, topAlerts, filteredTransactions, timeRange, isAdmin, user]);

  // Auto-validate once data loads and whenever the underlying data or time range changes
  useEffect(() => {
    if (!loading) runIntegrityCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, filteredTransactions.length, filteredAlerts.length, timeRange]);

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <header className="bg-white border-b border-slate-200 px-4 md:px-8 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <h1 className="text-lg font-bold text-[#231F20] flex items-center gap-2">
              <span>{greeting}, {userFirstName}!</span>
              <span className="text-2xl">{greeting === "Good morning" ? "☀️" : greeting === "Good afternoon" ? "🌤️" : "🌙"}</span>
            </h1>
            <p className="text-xs text-slate-500">
              Risk health overview · Updated just now
              {!isAdmin && <span className="ml-1 text-slate-400">· Scoped to your role ({getRoleLabel(role)})</span>}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
            <CurrencySelector />
            {hasNoData && (
              <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-semibold border border-emerald-200 animate-pulse">
                <Sparkles className="w-3 h-3" /> Start here
              </span>
            )}
            <Link
              to="/ingestion"
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors ${hasNoData ? "ring-2 ring-emerald-400 shadow-lg shadow-emerald-500/30" : ""}`}
            >
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Ingest Data</span>
            </Link>
            <NotificationBell />
          </div>
          <WeatherClock className="ml-auto" />
        </div>
      </header>

      <div className="p-4 md:p-8 space-y-6">
        {isOversightManagerRole(role) && (
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Raviqen management oversight</p>
            <h2 className="mt-2 max-w-3xl text-xl font-bold text-slate-900">{OVERSIGHT_HERO}</h2>
            <Link to="/oversight" className="mt-4 inline-flex rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white">Open Raviqen Inbox</Link>
          </section>
        )}
        {hasNoData ? (
          <>
            <OnboardingTour />
            <div className="flex items-start gap-2 px-3.5 py-2.5 rounded-lg bg-sky-50 border border-sky-200 text-xs text-sky-700">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>The time-range filters, currency selector, and notification bell above are active and ready — they'll populate with live data the moment you ingest your first transaction dataset.</span>
            </div>
            <EmptyState
              icon={Upload}
              title="No data connected yet"
              description="RAVIQEN needs your first dataset to begin risk monitoring. Ingest a transaction file and we'll automatically scan for anomalies, build entity profiles, and generate your risk briefing."
              ctaLabel="Ingest Data"
              ctaTo="/ingestion"
            >
              <div className="mt-5 flex items-center justify-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/10 border border-white/15 text-xs font-medium text-slate-200"><FileText className="w-3.5 h-3.5" /> CSV</span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/10 border border-white/15 text-xs font-medium text-slate-200"><FileSpreadsheet className="w-3.5 h-3.5" /> Excel</span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/10 border border-white/15 text-xs font-medium text-slate-200"><FileJson className="w-3.5 h-3.5" /> JSON</span>
              </div>
              <p className="mt-3 text-[11px] text-slate-500">Include columns like transaction_id, vendor, amount, date and category for the richest analysis.</p>
            </EmptyState>
          </>
        ) : (
        <>
        {/* Data Integrity Verification */}
        <DataIntegrityPanel
          validation={integrityValidation}
          isValidating={integrityLoading}
          onRevalidate={runIntegrityCheck}
        />

        {/* Quick Actions */}
        <QuickActions />

        {/* High-Risk Alert Banner */}
        <HighRiskAlertBanner alerts={filteredAlerts} />

        {/* AI Risk Briefing */}
        <RiskNarrative
          narrative={narrative?.narrative}
          recommendation={narrative?.recommendation}
          severity={narrativeSeverity}
          loading={narrativeLoading}
          onRegenerate={runNarrative}
        />

        {/* Critical Action Required */}
        <CriticalSummary transactions={criticalActionTx} loading={loading} onInvestigate={handleInvestigate} onDelete={handleDeleteTransaction} />

        {/* Stat cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Exposure"
            value={formatCompact(convertAmount(stats.exposure, "USD", displayCurrency, rates), displayCurrency)}
            sublabel={`${stats.flagged} flagged transactions`}
            icon={DollarSign}
            accent="red"
            trend="+12.4%"
            trendUp
          />
          <StatCard
            label="Open Alerts"
            value={stats.openAlerts}
            sublabel={`${stats.critical} critical priority`}
            icon={ShieldAlert}
            accent="amber"
            trend="-8.1%"
          />
          <StatCard
            label="Avg Risk Score"
            value={stats.avgRisk.toFixed(1)}
            sublabel="Across all transactions"
            icon={Activity}
            accent="violet"
            trend="+3.2"
            trendUp
          />
          <StatCard
            label="Transactions Monitored"
            value={stats.totalTx.toLocaleString()}
            sublabel={timeRange === "all" ? "All time" : timeRange === "7d" ? "Last 7 days" : timeRange === "90d" ? "Last 90 days" : "Last 30 days"}
            icon={FileSearch}
            accent="blue"
            trend="+5.6%"
          />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-[#231F20]">Risk Activity Trend</h3>
                <p className="text-xs text-slate-400">Flagged vs clean transactions · with predictive forecast</p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500" />Flagged</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" />Clean</span>
                <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 rounded-full bg-violet-600" style={{ borderTop: "2px dashed #7c3aed" }} />Forecast</span>
              </div>
            </div>
            <RiskTrendChart data={trendDataWithProjection} hasProjection />
            <div className="mt-3 flex items-center gap-3 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-50 text-violet-700 border border-violet-100 text-xs font-medium">
                <Sparkles className="w-3 h-3" />
                Next-period forecast: {forecast.nextFlaggedVolume} flagged · risk {forecast.nextRiskScore?.toFixed(0)}
              </span>
              <span className="text-[11px] text-slate-400">Projected via linear regression on flagged-volume trend</span>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-[#231F20]">Risk Health</h3>
              <span className="text-xs text-slate-400">Composite</span>
            </div>
            <div className="flex flex-col items-center justify-center py-4">
              {riskFactors.composite == null ? (
                <p className="py-10 text-sm font-medium text-slate-600">Not scored</p>
              ) : (
                <RiskScoreRing score={riskFactors.composite} level={riskFactors.composite >= 75 ? "critical" : riskFactors.composite >= 55 ? "high" : riskFactors.composite >= 30 ? "medium" : "low"} size={120} />
              )}
              <p className="mt-3 text-xs text-slate-500 text-center max-w-[200px]">
                {riskFactors.composite == null ? "Insufficient evidence to calculate a composite risk factor score." : "Composite of scored factors only; see source reasons below."}
              </p>
            </div>
          </div>
        </div>

        {/* Anomaly detection + Risk factors */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <AnomalyPanel anomalies={anomalies} loading={loading} />
          </div>
          <RiskFactorsChart factors={riskFactors.factors} composite={riskFactors.composite} />
        </div>

        {/* Alerts + distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-[#231F20]">Priority Alerts</h3>
                <p className="text-xs text-slate-400">Highest risk transactions requiring attention</p>
              </div>
              <Link to="/alerts" className="text-xs font-medium text-slate-600 hover:text-slate-900 inline-flex items-center gap-1">
                View all <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 rounded-lg bg-slate-100 animate-pulse" />
                ))}
              </div>
            ) : topAlerts.length === 0 ? (
              <div className="text-center py-10">
                <ShieldAlert className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-sm text-slate-500 mb-3">No alerts yet. Ingest data to populate risk signals.</p>
                <Link to="/ingestion" className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 hover:text-emerald-700">
                  <Upload className="w-3.5 h-3.5" /> Ingest Data
                </Link>
              </div>
            ) : (
              <div className="space-y-2.5">
                {topAlerts.map((alert) => (
                  <AlertCard key={alert.id} alert={alert} />
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-[#231F20] mb-1">Risk by Category</h3>
            <p className="text-xs text-slate-400 mb-4">Transaction volume distribution</p>
            <RiskDistributionChart data={distData} />
          </div>
        </div>

        {/* Recent Activity Feed */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <ActivityFeed maxItems={10} />
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-[#231F20] mb-3">System Status</h3>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Fraud Detection</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Active
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Screening Engine</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Running
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Real-time Monitoring</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Data Ingestion</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">Idle</span>
              </div>
            </div>
          </div>
        </div>
        </>
        )}
      </div>

      <BackToTop />
    </div>
  );
}