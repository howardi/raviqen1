import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, TrendingUp, Globe, AlertTriangle, Sparkles, Lightbulb } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, LineChart, Line, CartesianGrid, Legend } from "recharts";
import { computeRiskFactors, detectAnomalies, forecastTrend } from "@/lib/dashboardAI";
import { generateInsightsNarrative } from "@/lib/advancedAI";
import { useCurrency } from "@/lib/CurrencyContext";
import { convertAmount } from "@/lib/currencyUtils";
import { cn } from "@/lib/utils";
import TimeRangeSelector, { filterByDateRange } from "@/components/TimeRangeSelector";

const regionMap = {
  "North America": ["US", "CA", "MX", "USA", "Canada"],
  "Europe": ["UK", "GB", "DE", "FR", "IT", "ES", "NL", "Europe"],
  "Asia Pacific": ["CN", "JP", "KR", "IN", "SG", "HK", "AU", "Asia"],
  "Middle East": ["AE", "SA", "QA", "KW", "IL", "IR", "Middle East"],
  "Africa": ["ZA", "NG", "EG", "KE", "GH", "Africa"],
  "South America": ["BR", "AR", "CL", "CO", "South America"],
};

function getRegion(location) {
  if (!location) return "Unknown";
  for (const [region, codes] of Object.entries(regionMap)) {
    if (codes.some((c) => location.toUpperCase().includes(c.toUpperCase()))) return region;
  }
  return "Other";
}

export default function AnalyticsInsights() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [timeRange, setTimeRange] = useState("90d");
  const { displayCurrency, rates } = useCurrency();

  useEffect(() => {
    base44.entities.Transaction.list("-created_date", 100)
      .then((data) => { setTransactions(data || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filteredTx = useMemo(
    () => filterByDateRange(transactions, timeRange, ["created_date", "transaction_date"]),
    [transactions, timeRange]
  );

  const { riskFactors, anomalies, forecast, geoData, trendData, stats } = useMemo(() => {
    const { factors, composite } = computeRiskFactors(filteredTx);
    const anoms = detectAnomalies(filteredTx);
    const fc = forecastTrend([], 3);
    const flagged = filteredTx.filter((t) => t.status === "flagged").length;
    const critical = filteredTx.filter((t) => t.risk_level === "critical").length;
    const exposure = filteredTx.filter((t) => t.status === "flagged").reduce((s, t) => s + convertAmount(t.amount, t.currency || "USD", displayCurrency, rates), 0);
    const avgRisk = filteredTx.length ? filteredTx.reduce((s, t) => s + (t.risk_score || 0), 0) / filteredTx.length : 0;

    // Geographic distribution
    const geoCounts = {};
    filteredTx.forEach((t) => {
      const region = getRegion(t.location);
      geoCounts[region] = geoCounts[region] || { count: 0, flagged: 0 };
      geoCounts[region].count++;
      if (t.status === "flagged") geoCounts[region].flagged++;
    });
    const geo = Object.entries(geoCounts).map(([region, d]) => ({
      region, count: d.count,
      risk: d.flagged / d.count > 0.3 ? "high" : d.flagged / d.count > 0.1 ? "medium" : "low",
    })).sort((a, b) => b.count - a.count);

    // Trend data from created_date
    const monthMap = {};
    filteredTx.forEach((t) => {
      const d = new Date(t.created_date || t.transaction_date);
      if (isNaN(d)) return;
      const key = d.toLocaleDateString("en", { month: "short" });
      monthMap[key] = monthMap[key] || { month: key, flagged: 0, clean: 0 };
      if (t.status === "flagged") monthMap[key].flagged++;
      else monthMap[key].clean++;
    });
    const trend = Object.values(monthMap).slice(-8);

    return {
      riskFactors: factors, anomalies: anoms, forecast: fc,
      geoData: geo, trendData: trend,
      stats: { totalTx: filteredTx.length, flagged, critical, exposure, avgRisk },
    };
  }, [filteredTx, displayCurrency, rates]);

  const handleInsights = async () => {
    setInsightsLoading(true);
    try {
      const result = await generateInsightsNarrative(stats, anomalies, riskFactors);
      setInsights(result);
    } catch (e) { console.error(e); }
    setInsightsLoading(false);
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  const geoMax = Math.max(...geoData.map((d) => d.count), 1);

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-slate-200 px-4 md:px-8 py-4 sticky top-0 z-10 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-[#231F20]">Analytics & Insights</h1>
          <p className="text-xs text-slate-500">Geographic distribution, risk factor analysis, and predictive forecasting</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
          <button onClick={handleInsights} disabled={insightsLoading} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors">
            {insightsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            AI Insights
          </button>
        </div>
      </header>

      <div className="p-4 md:p-8 space-y-6">
        {/* AI Insights */}
        {insights && (
          <div className="bg-gradient-to-br from-indigo-50 to-white rounded-xl border border-indigo-200 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-semibold text-[#231F20]">AI-Generated Insights</h3>
            </div>
            {insights.summary && <p className="text-sm text-slate-600 mb-3">{insights.summary}</p>}
            <div className="space-y-2">
              {(insights.insights || []).map((ins, i) => (
                <div key={i} className={cn("p-3 rounded-lg border", ins.severity === "critical" ? "bg-red-50 border-red-200" : ins.severity === "warning" ? "bg-amber-50 border-amber-200" : "bg-slate-50 border-slate-200")}>
                  <p className="text-sm font-semibold text-[#231F20]">{ins.title}</p>
                  <p className="text-xs text-slate-600 mt-0.5">{ins.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Geographic Heatmap */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-semibold text-[#231F20]">Geographic Risk Distribution</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {geoData.map((g) => {
              const intensity = g.count / geoMax;
              const bg = g.risk === "high" ? `rgba(239, 68, 68, ${0.15 + intensity * 0.6})` : g.risk === "medium" ? `rgba(245, 158, 11, ${0.15 + intensity * 0.6})` : `rgba(16, 185, 129, ${0.15 + intensity * 0.6})`;
              return (
                <div key={g.region} className="rounded-lg p-4 border border-slate-100" style={{ background: bg }}>
                  <p className="text-xs font-semibold text-[#231F20]">{g.region}</p>
                  <p className="text-2xl font-bold text-[#231F20] mt-1">{g.count}</p>
                  <p className="text-[10px] text-slate-600 capitalize">{g.risk} risk zone</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Risk Factor Contribution */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-4 h-4 text-slate-500" />
              <h3 className="text-sm font-semibold text-[#231F20]">Risk Factor Contribution</h3>
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={riskFactors} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: "#94a3b8" }} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} width={100} />
                <Tooltip cursor={{ fill: "#f8fafc" }} />
                <Bar dataKey="score" fill="#f97316" radius={[0, 4, 4, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Predictive Trend Forecasting */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-slate-500" />
              <h3 className="text-sm font-semibold text-[#231F20]">Transaction Trend (Flagged vs Clean)</h3>
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="flagged" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="clean" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Anomalies */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-[#231F20] mb-4">Detected Anomalies</h3>
          <div className="space-y-2">
            {anomalies.slice(0, 5).map((a, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100">
                <span className="text-xs font-mono text-slate-500 shrink-0">{a.transaction_id}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#231F20]">{a.vendor}</p>
                  <p className="text-xs text-slate-500">{a.reasons.join(" · ")}</p>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold border border-amber-200">{a.confidence}%</span>
              </div>
            ))}
            {anomalies.length === 0 && <p className="text-xs text-slate-400 text-center py-4">No anomalies detected</p>}
          </div>
        </div>
      </div>
    </div>
  );
}