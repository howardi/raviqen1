import React, { useState, useEffect, useMemo } from "react";
import { Network, Loader2, ShieldAlert, Share2, AlertTriangle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { analyzeCollusion } from "@/lib/collusionAnalysis";
import CollusionGraph from "@/components/collusion/CollusionGraph";
import RiskBadge from "@/components/RiskBadge";
import BackToTop from "@/components/BackToTop";

const SIGNAL_LABELS = {
  shared_location: "Shared Location",
  shared_payment_method: "Shared Payment Method",
  shared_category: "Shared Category",
  name_similarity: "Name Similarity",
  ai_intel: "AI Intelligence",
};

export default function CollusionDetector() {
  const [transactions, setTransactions] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedCluster, setSelectedCluster] = useState(null);

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

  const runAnalysis = async () => {
    setAnalyzing(true);
    try {
      const result = await analyzeCollusion(transactions);
      setAnalysis(result);
    } catch (e) {
      console.error(e);
    } finally {
      setAnalyzing(false);
    }
  };

  useEffect(() => {
    if (!loading && transactions.length) runAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, transactions.length]);

  const highRiskLinks = useMemo(
    () => analysis?.links.filter((l) => l.confidence >= 50).sort((a, b) => b.confidence - a.confidence) || [],
    [analysis]
  );

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-slate-200 px-4 md:px-8 py-4 sticky top-0 z-10 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#231F20] flex items-center gap-2">
            <Network className="w-5 h-5 text-slate-700" />
            Collusion Detector
          </h1>
          <p className="text-xs text-slate-500">Cross-entity link analysis across all active vendors</p>
        </div>
        <button
          onClick={runAnalysis}
          disabled={analyzing || loading}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
        >
          {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Share2 className="w-3.5 h-3.5" />}
          {analyzing ? "Analyzing..." : "Re-run Analysis"}
        </button>
      </header>

      <div className="p-4 md:p-8 space-y-6">
        {loading || analyzing ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin mb-3" />
            <p className="text-sm">{loading ? "Loading vendor data..." : "Running collusion analysis..."}</p>
          </div>
        ) : !analysis ? (
          <div className="text-center py-20 text-sm text-slate-400">
            <Network className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            No data available for analysis
          </div>
        ) : (
          <>
            {/* Summary stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Vendors Analyzed", value: analysis.summary.totalVendors, icon: Network, color: "text-slate-700" },
                { label: "Links Detected", value: analysis.summary.totalLinks, icon: Share2, color: "text-blue-600" },
                { label: "High-Risk Links", value: analysis.summary.highRiskLinks, icon: AlertTriangle, color: "text-red-600" },
                { label: "Collusion Clusters", value: analysis.summary.clusters, icon: ShieldAlert, color: "text-orange-600" },
              ].map((s) => {
                const Icon = s.icon;
                return (
                  <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4">
                    <Icon className={`w-5 h-5 mb-2 ${s.color}`} />
                    <div className="text-2xl font-bold text-[#231F20]">{s.value}</div>
                    <div className="text-xs text-slate-500">{s.label}</div>
                  </div>
                );
              })}
            </div>

            {/* Graph */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-[#231F20] mb-1">Vendor Relationship Network</h3>
              <p className="text-xs text-slate-400 mb-4">Node size = link count · Edge color = confidence · Dashed = lower confidence</p>
              <CollusionGraph nodes={analysis.nodes} links={analysis.links} />
            </div>

            {/* Clusters + High-risk links */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-[#231F20] mb-3">Detected Collusion Clusters</h3>
                {analysis.clusters.length === 0 ? (
                  <p className="text-sm text-slate-400 py-8 text-center">No multi-vendor clusters detected</p>
                ) : (
                  <div className="space-y-2.5">
                    {analysis.clusters.map((c, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedCluster(selectedCluster === i ? null : i)}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${
                          selectedCluster === i ? "border-slate-900 bg-slate-50" : "border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-semibold text-slate-800">Cluster {i + 1} · {c.members.length} vendors</span>
                          <RiskBadge level={c.avgConfidence >= 70 ? "critical" : c.avgConfidence >= 50 ? "high" : "medium"} size="sm" />
                        </div>
                        <div className="text-[11px] text-slate-500 mb-1">{c.members.join(" · ")}</div>
                        <div className="flex flex-wrap gap-1">
                          {[...new Set(c.topSignals)].map((sig, j) => (
                            <span key={j} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                              {SIGNAL_LABELS[sig] || sig}
                            </span>
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-[#231F20] mb-3">High-Confidence Links</h3>
                {highRiskLinks.length === 0 ? (
                  <p className="text-sm text-slate-400 py-8 text-center">No high-confidence links detected</p>
                ) : (
                  <div className="space-y-2">
                    {highRiskLinks.slice(0, 10).map((l, i) => (
                      <div key={i} className="p-3 rounded-lg border border-slate-200">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-slate-800">{l.source} ↔ {l.target}</span>
                          <span className={`text-xs font-bold ${l.confidence >= 70 ? "text-red-600" : "text-orange-600"}`}>
                            {Math.round(l.confidence)}%
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {l.signals.map((s, j) => (
                            <span key={j} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                              {SIGNAL_LABELS[s.type] || s.type}: {s.detail}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
      <BackToTop />
    </div>
  );
}