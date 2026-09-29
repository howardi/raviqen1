import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { TrendingDown, DollarSign, Percent, AlertTriangle, Activity, BarChart3 } from "lucide-react";
import { STRESS_SCENARIOS, runStressTest, computeExposureByCurrency, generateStressTestNarrative } from "@/lib/fxStressTest";
import StatCard from "@/components/StatCard";
import BackToTop from "@/components/BackToTop";
import { cn } from "@/lib/utils";

const SEVERITY_COLORS = {
  low: "border-emerald-200 bg-emerald-50",
  medium: "border-amber-200 bg-amber-50",
  high: "border-orange-200 bg-orange-50",
  critical: "border-red-200 bg-red-50",
};

export default function FXStressTest() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedScenario, setSelectedScenario] = useState(STRESS_SCENARIOS[0]);
  const [result, setResult] = useState(null);
  const [narrative, setNarrative] = useState(null);
  const [narrativeLoading, setNarrativeLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await base44.entities.Transaction.list("-created_date", 200);
        setTransactions(data);
      } catch {
        setTransactions([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const exposureByCurrency = useMemo(() => computeExposureByCurrency(transactions), [transactions]);

  useEffect(() => {
    if (transactions.length === 0) return;
    const sim = runStressTest(transactions, selectedScenario);
    setResult(sim);
    setNarrativeLoading(true);
    (async () => {
      try {
        const n = await generateStressTestNarrative({
          scenario: selectedScenario,
          result: sim,
          transactions,
        });
        setNarrative(n);
      } catch {
        setNarrative(null);
      } finally {
        setNarrativeLoading(false);
      }
    })();
  }, [selectedScenario, transactions]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center">
          <TrendingDown className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">FX Volatility Stress Testing</h1>
          <p className="text-sm text-slate-500">Simulate currency exchange rate shocks and assess portfolio exposure impact</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Exposure"
          value={`$${(result?.baseline_exposure_usd || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          icon={DollarSign}
          accent="blue"
        />
        <StatCard
          label="Stressed Exposure"
          value={`$${(result?.stressed_exposure_usd || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          icon={TrendingDown}
          accent="red"
        />
        <StatCard
          label="Impact"
          value={`$${Math.abs(result?.total_impact_usd || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          sublabel={`${(result?.total_impact_pct || 0).toFixed(1)}% change`}
          icon={Percent}
          accent="orange"
        />
        <StatCard
          label="Risk Increase"
          value={`+${result?.risk_score_increase || 0}`}
          sublabel="points"
          icon={AlertTriangle}
          accent="amber"
        />
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-violet-500" />
            Stress Scenarios
          </h3>
          <div className="space-y-2">
            {STRESS_SCENARIOS.map((scenario) => (
              <button
                key={scenario.id}
                onClick={() => setSelectedScenario(scenario)}
                className={cn(
                  "w-full text-left p-3 rounded-lg border transition-colors",
                  selectedScenario.id === scenario.id
                    ? "border-violet-500 bg-violet-50"
                    : "border-slate-200 hover:border-slate-300"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-800">{scenario.label}</span>
                  <span className={cn("text-xs px-1.5 py-0.5 rounded-full", SEVERITY_COLORS[scenario.severity])}>
                    {scenario.severity}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">{scenario.description}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="md:col-span-2 space-y-4">
          {result && (
            <>
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-violet-500" />
                  Currency Impact Breakdown
                </h3>
                <div className="space-y-3">
                  {result.currency_impacts.map((c, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-sm font-medium text-slate-700 w-12">{c.currency}</span>
                      <span className="text-xs text-slate-400 w-16">{c.shock_pct > 0 ? `+${c.shock_pct}%` : "—"}</span>
                      <div className="flex-1">
                        <div className="flex justify-between text-xs text-slate-500 mb-1">
                          <span>${(c.baseline_exposure_usd || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                          <span className={c.impact_usd < 0 ? "text-red-600" : "text-emerald-600"}>
                            {c.impact_usd < 0 ? "-" : "+"}${Math.abs(c.impact_usd).toLocaleString(undefined, { maximumFractionDigits: 0 })} ({c.impact_pct.toFixed(1)}%)
                          </span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={cn("h-full rounded-full", c.impact_usd < 0 ? "bg-red-500" : "bg-emerald-500")}
                            style={{ width: `${Math.min(100, Math.abs(c.impact_pct))}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-xs text-slate-400 w-16 text-right">{c.transaction_count} tx</span>
                    </div>
                  ))}
                </div>
              </div>

              {narrative && (
                <div className="bg-violet-50 border border-violet-200 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-5 h-5 text-violet-600" />
                    <h3 className="font-semibold text-slate-800">AI Resilience Assessment</h3>
                    {narrative.resilience_rating && (
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded-full",
                        narrative.resilience_rating === "strong" ? "bg-emerald-100 text-emerald-700" :
                        narrative.resilience_rating === "adequate" ? "bg-blue-100 text-blue-700" :
                        narrative.resilience_rating === "vulnerable" ? "bg-amber-100 text-amber-700" :
                        "bg-red-100 text-red-700"
                      )}>
                        {narrative.resilience_rating}
                      </span>
                    )}
                  </div>
                  {narrativeLoading ? (
                    <div className="space-y-2">
                      <div className="h-3 bg-violet-200/50 rounded animate-pulse" />
                      <div className="h-3 bg-violet-200/50 rounded w-4/5 animate-pulse" />
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-slate-700 leading-relaxed">{narrative.assessment}</p>
                      {narrative.recommendation && (
                        <div className="mt-3 pt-3 border-t border-violet-200">
                          <p className="text-xs font-semibold text-violet-700">Recommendation:</p>
                          <p className="text-sm text-slate-600 mt-1">{narrative.recommendation}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <BackToTop />
    </div>
  );
}