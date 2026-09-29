import React, { useState, useEffect, useMemo } from "react";
import { FlaskConical, Loader2, TrendingUp, TrendingDown, Sparkles, Play } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { runSimulation, generateSimulationNarrative } from "@/lib/simulationEngine";
import { useCurrency } from "@/lib/CurrencyContext";
import { convertAndFormat } from "@/lib/currencyUtils";
import BackToTop from "@/components/BackToTop";
import { cn } from "@/lib/utils";

export default function WhatIfSandbox() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState(null);
  const [narrative, setNarrative] = useState("");
  const [narrativeLoading, setNarrativeLoading] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const { displayCurrency, rates } = useCurrency();

  const [scenario, setScenario] = useState({
    vendorName: "",
    riskLevel: "high",
    amount: 50000,
    category: "Procurement",
    location: "Lagos, NG",
    transactionCount: 5,
    paymentMethod: "Bank Transfer",
  });

  useEffect(() => {
    (async () => {
      try {
        const data = await base44.entities.Transaction.list("-created_date", 200);
        setTransactions(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSimulate = async () => {
    setSimulating(true);
    setNarrative("");
    try {
      const sim = runSimulation(transactions, scenario, rates);
      setResult(sim);
      setNarrativeLoading(true);
      const narr = await generateSimulationNarrative(scenario, sim);
      setNarrative(narr);
    } catch (e) {
      console.error(e);
    } finally {
      setSimulating(false);
      setNarrativeLoading(false);
    }
  };

  const factorMap = useMemo(() => {
    if (!result) return {};
    const map = {};
    result.projected.factors.forEach((f) => {
      const base = result.baseline.factors.find((bf) => bf.key === f.key);
      map[f.label] = { current: f.score, baseline: base?.score || 0 };
    });
    return map;
  }, [result]);

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-slate-200 px-4 md:px-8 py-4 sticky top-0 z-10">
        <h1 className="text-lg font-bold text-[#231F20] flex items-center gap-2">
          <FlaskConical className="w-5 h-5 text-violet-600" />
          What-If Risk Sandbox
        </h1>
        <p className="text-xs text-slate-500">Simulate hypothetical scenarios to forecast risk impact before committing</p>
      </header>

      <div className="p-4 md:p-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scenario builder */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-[#231F20]">Scenario Parameters</h3>

          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">Vendor Name</label>
            <input
              type="text"
              value={scenario.vendorName}
              onChange={(e) => setScenario({ ...scenario, vendorName: e.target.value })}
              placeholder="e.g. New Logistics Partner Ltd"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-slate-400 focus:ring-1 focus:ring-slate-300 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">Risk Level</label>
              <select
                value={scenario.riskLevel}
                onChange={(e) => setScenario({ ...scenario, riskLevel: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-slate-400 outline-none"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">Transaction Count</label>
              <input
                type="number"
                value={scenario.transactionCount}
                onChange={(e) => setScenario({ ...scenario, transactionCount: parseInt(e.target.value) || 1 })}
                min="1"
                max="50"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-slate-400 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">Amount per Transaction (USD)</label>
              <input
                type="number"
                value={scenario.amount}
                onChange={(e) => setScenario({ ...scenario, amount: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-slate-400 outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">Category</label>
              <select
                value={scenario.category}
                onChange={(e) => setScenario({ ...scenario, category: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-slate-400 outline-none"
              >
                <option>Procurement</option>
                <option>Payroll</option>
                <option>Vendor Payment</option>
                <option>Expenses</option>
                <option>Transfers</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">Location</label>
              <input
                type="text"
                value={scenario.location}
                onChange={(e) => setScenario({ ...scenario, location: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-slate-400 outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">Payment Method</label>
              <select
                value={scenario.paymentMethod}
                onChange={(e) => setScenario({ ...scenario, paymentMethod: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-slate-400 outline-none"
              >
                <option>Bank Transfer</option>
                <option>Cheque</option>
                <option>Cash</option>
                <option>Card</option>
                <option>Mobile Money</option>
              </select>
            </div>
          </div>

          <button
            onClick={handleSimulate}
            disabled={simulating || loading || !scenario.vendorName}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors"
          >
            {simulating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {simulating ? "Simulating..." : "Run Simulation"}
          </button>
          {!scenario.vendorName && (
            <p className="text-[11px] text-slate-400 text-center">Enter a vendor name to run the simulation</p>
          )}
        </div>

        {/* Results */}
        <div className="space-y-4">
          {!result ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <FlaskConical className="w-10 h-10 mx-auto text-slate-300 mb-3" />
              <p className="text-sm text-slate-400">Configure a scenario and run the simulation to see projected risk impact</p>
            </div>
          ) : (
            <>
              {/* Composite score comparison */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-[#231F20] mb-4">Composite Risk Score Impact</h3>
                <div className="flex items-center justify-between gap-4">
                  <div className="text-center">
                    <div className="text-xs text-slate-500 mb-1">Baseline</div>
                    <div className="text-3xl font-bold text-slate-700">{result.baseline.composite}</div>
                  </div>
                  <div className="flex-1 text-center">
                    <div className={cn(
                      "inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-bold",
                      result.delta.composite > 0 ? "bg-red-50 text-red-600" : result.delta.composite < 0 ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-600"
                    )}>
                      {result.delta.composite > 0 ? <TrendingUp className="w-4 h-4" /> : result.delta.composite < 0 ? <TrendingDown className="w-4 h-4" /> : null}
                      {result.delta.composite >= 0 ? "+" : ""}{result.delta.composite}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">delta</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-slate-500 mb-1">Projected</div>
                    <div className={cn(
                      "text-3xl font-bold",
                      result.projected.composite > 70 ? "text-red-600" : result.projected.composite > 50 ? "text-orange-600" : "text-emerald-600"
                    )}>
                      {result.projected.composite}
                    </div>
                  </div>
                </div>
              </div>

              {/* Exposure + flagged */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="text-xs text-slate-500 mb-1">Exposure</div>
                  <div className="text-lg font-bold text-[#231F20]">
                    {convertAndFormat(result.projected.exposure, "USD", displayCurrency, rates)}
                  </div>
                  <div className={cn("text-[11px] font-medium", result.delta.exposure > 0 ? "text-red-500" : "text-emerald-500")}>
                    {result.delta.exposure >= 0 ? "+" : ""}{convertAndFormat(Math.abs(result.delta.exposure), "USD", displayCurrency, rates)} change
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="text-xs text-slate-500 mb-1">Flagged Transactions</div>
                  <div className="text-lg font-bold text-[#231F20]">{result.projected.flagged}</div>
                  <div className={cn("text-[11px] font-medium", result.delta.flagged > 0 ? "text-red-500" : "text-emerald-500")}>
                    {result.delta.flagged >= 0 ? "+" : ""}{result.delta.flagged} new flags
                  </div>
                </div>
              </div>

              {/* Risk factor breakdown */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-[#231F20] mb-3">Risk Factor Changes</h3>
                <div className="space-y-2.5">
                  {Object.entries(factorMap).map(([name, vals]) => {
                    const delta = vals.current - vals.baseline;
                    return (
                      <div key={name} className="flex items-center gap-2 sm:gap-3">
                        <span className="text-xs text-slate-600 w-24 sm:w-32 truncate">{name}</span>
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden relative">
                          <div className="absolute h-full bg-slate-300 rounded-full" style={{ width: `${vals.baseline}%` }} />
                          <div className={cn("absolute h-full rounded-full opacity-80", delta > 5 ? "bg-red-500" : delta < -5 ? "bg-emerald-500" : "bg-blue-500")} style={{ width: `${vals.current}%` }} />
                        </div>
                        <span className={cn("text-xs font-semibold w-12 text-right", delta > 5 ? "text-red-600" : delta < -5 ? "text-emerald-600" : "text-slate-600")}>
                          {Math.round(vals.current)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* AI narrative */}
              <div className="bg-violet-50 rounded-xl border border-violet-200 p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-violet-600" />
                  <h3 className="text-sm font-semibold text-violet-900">AI Assessment</h3>
                </div>
                {narrativeLoading ? (
                  <div className="flex items-center gap-2 text-sm text-violet-600">
                    <Loader2 className="w-4 h-4 animate-spin" /> Analyzing simulation results...
                  </div>
                ) : (
                  <p className="text-sm text-violet-800 leading-relaxed">{narrative}</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      <BackToTop />
    </div>
  );
}