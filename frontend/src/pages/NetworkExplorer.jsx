import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, ZoomIn, ZoomOut, Maximize2, Sparkles, Network as NetworkIcon } from "lucide-react";
import { detectRiskClusters } from "@/lib/advancedAI";
import { cn } from "@/lib/utils";

export default function NetworkExplorer() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [selectedNode, setSelectedNode] = useState(null);
  const [clusters, setClusters] = useState(null);
  const [clusterLoading, setClusterLoading] = useState(false);

  useEffect(() => {
    base44.entities.Transaction.list("-risk_score", 30)
      .then((data) => { setTransactions(data || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const { nodes, edges } = useMemo(() => {
    const vendorMap = {};
    transactions.forEach((t) => {
      const v = t.vendor || "Unknown";
      if (!vendorMap[v]) vendorMap[v] = { id: `v_${v}`, label: v, type: "vendor", txs: [], riskLevel: t.risk_level };
      vendorMap[v].txs.push(t);
      if (t.risk_level === "critical" || t.risk_level === "high") vendorMap[v].riskLevel = t.risk_level;
    });
    const vendors = Object.values(vendorMap);
    const txNodes = transactions.slice(0, 20).map((t) => ({ id: `t_${t.id}`, label: t.transaction_id, type: "transaction", risk: t.risk_level, vendor: t.vendor, amount: t.amount, currency: t.currency, date: t.transaction_date, category: t.category, location: t.location }));
    const e = [];
    txNodes.forEach((tn) => { const v = vendors.find((x) => x.label === tn.vendor); if (v) e.push({ from: v.id, to: tn.id }); });
    const allNodes = [...vendors, ...txNodes];
    const radius = 220;
    allNodes.forEach((n, i) => {
      const angle = (i / allNodes.length) * 2 * Math.PI;
      n.x = 350 + radius * Math.cos(angle);
      n.y = 300 + radius * Math.sin(angle);
    });
    return { nodes: allNodes, edges: e };
  }, [transactions]);

  const nodeColor = (n) => {
    if (n.type === "vendor") return "#6366f1";
    if (n.risk === "critical") return "#ef4444";
    if (n.risk === "high") return "#f97316";
    if (n.risk === "medium") return "#f59e0b";
    return "#10b981";
  };

  const handleClusters = async () => {
    setClusterLoading(true);
    try {
      const result = await detectRiskClusters(transactions);
      setClusters(result.clusters || []);
    } catch (e) { console.error(e); }
    setClusterLoading(false);
  };

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-slate-200 px-4 md:px-8 py-4 sticky top-0 z-10 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#231F20]">Network Explorer</h1>
          <p className="text-xs text-slate-500">Interactive graph of linked entities and transactions</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleClusters} disabled={clusterLoading} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors">
            {clusterLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            AI Detect Clusters
          </button>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setZoom((z) => Math.max(0.5, z - 0.2))} className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"><ZoomOut className="w-4 h-4 text-slate-600" /></button>
            <span className="text-xs text-slate-500 w-10 text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom((z) => Math.min(2, z + 0.2))} className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"><ZoomIn className="w-4 h-4 text-slate-600" /></button>
            <button onClick={() => setZoom(1)} className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"><Maximize2 className="w-4 h-4 text-slate-600" /></button>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : (
        <div className="p-4 md:p-8 space-y-4">
          {/* AI Clusters */}
          {clusters && (
            <div className="bg-white rounded-xl border border-indigo-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <NetworkIcon className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-semibold text-[#231F20]">AI-Detected Risk Clusters</h3>
              </div>
              <div className="space-y-2">
                {clusters.map((c, i) => (
                  <div key={i} className="p-3 rounded-lg border border-slate-200 bg-slate-50/60">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-semibold text-[#231F20]">{c.name}</p>
                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-bold", c.risk_score > 70 ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700")}>{c.risk_score}/100</span>
                    </div>
                    <p className="text-xs text-slate-600">{c.pattern}</p>
                    <p className="text-xs text-slate-500 mt-1"><span className="font-medium">Entities:</span> {c.entities?.join(", ") || "N/A"}</p>
                    <p className="text-xs text-indigo-600 mt-1">{c.recommendation}</p>
                  </div>
                ))}
                {clusters.length === 0 && <p className="text-xs text-slate-400 text-center py-3">No risk clusters detected</p>}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Graph */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden" style={{ height: "500px" }}>
              <svg width="100%" height="100%" viewBox="0 0 700 600" style={{ transform: `scale(${zoom})`, transformOrigin: "center" }}>
                {edges.map((e, i) => {
                  const from = nodes.find((n) => n.id === e.from);
                  const to = nodes.find((n) => n.id === e.to);
                  if (!from || !to) return null;
                  return <line key={i} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#e2e8f0" strokeWidth="1.5" />;
                })}
                {nodes.map((n) => (
                  <g key={n.id} onClick={() => setSelectedNode(n)} style={{ cursor: "pointer" }}>
                    <circle cx={n.x} cy={n.y} r={n.type === "vendor" ? 8 : 5} fill={nodeColor(n)} stroke="white" strokeWidth="2" className="hover:opacity-80 transition-opacity" />
                    <text x={n.x} y={n.y + (n.type === "vendor" ? 20 : 16)} textAnchor="middle" style={{ fontSize: "9px", fill: "#64748b" }}>
                      {n.label.length > 15 ? n.label.slice(0, 13) + "…" : n.label}
                    </text>
                  </g>
                ))}
              </svg>
            </div>

            {/* Node Details */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-[#231F20] mb-3">Node Details</h3>
              {!selectedNode ? (
                <p className="text-xs text-slate-400 text-center py-8">Click a node in the graph to see details</p>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ background: nodeColor(selectedNode) }} />
                    <span className="text-sm font-semibold text-[#231F20]">{selectedNode.label}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 capitalize">{selectedNode.type}</span>
                  </div>
                  {selectedNode.type === "transaction" ? (
                    <>
                      {selectedNode.vendor && <div><p className="text-xs text-slate-400">Vendor</p><p className="text-sm text-slate-700">{selectedNode.vendor}</p></div>}
                      {selectedNode.amount != null && <div><p className="text-xs text-slate-400">Amount</p><p className="text-sm text-slate-700">{selectedNode.amount} {selectedNode.currency || ""}</p></div>}
                      {selectedNode.date && <div><p className="text-xs text-slate-400">Date</p><p className="text-sm text-slate-700">{selectedNode.date}</p></div>}
                      {selectedNode.category && <div><p className="text-xs text-slate-400">Category</p><p className="text-sm text-slate-700">{selectedNode.category}</p></div>}
                      {selectedNode.location && <div><p className="text-xs text-slate-400">Location</p><p className="text-sm text-slate-700">{selectedNode.location}</p></div>}
                      {selectedNode.risk && <div><p className="text-xs text-slate-400">Risk Level</p><p className="text-sm text-slate-700 capitalize">{selectedNode.risk}</p></div>}
                    </>
                  ) : (
                    <div>
                      <p className="text-xs text-slate-400">Linked Transactions</p>
                      <p className="text-sm text-slate-700">{selectedNode.txs?.length || 0} transactions</p>
                      {selectedNode.riskLevel && <div className="mt-2"><p className="text-xs text-slate-400">Risk Level</p><p className="text-sm text-slate-700 capitalize">{selectedNode.riskLevel}</p></div>}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-indigo-500" /> Vendor</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500" /> Critical</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-orange-500" /> High</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-500" /> Medium</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-500" /> Low</span>
          </div>
        </div>
      )}
    </div>
  );
}