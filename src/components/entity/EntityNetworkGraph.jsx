import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { mapRelationships } from "@/lib/entityIntelligence";
import { Loader2, Share2, Network, AlertTriangle } from "lucide-react";

const RISK_COLORS = { low: "#10b981", medium: "#f59e0b", high: "#f97316", critical: "#ef4444" };

export default function EntityNetworkGraph({ profile }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!profile?.id) return;
      try {
        const allProfiles = await base44.entities.EntityProfile.list("-created_date", 200);
        setData(await mapRelationships(profile, allProfiles));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [profile?.id]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-slate-300 animate-spin" /></div>;

  const counterparties = data?.linked_counterparties || [];
  const shared = data?.shared_identifiers || [];
  const collusion = data?.collusion_probability || 0;

  // Build graph nodes: center + radial
  const allNodes = [
    { name: profile.legal_name, isCenter: true, risk: profile.risk_level },
    ...counterparties.map((cp) => ({ name: cp.name, isCenter: false, txnCount: cp.transaction_count })),
    ...shared.map((s) => ({ name: s.entity, isCenter: false, sharedType: s.type })),
  ];
  // Deduplicate by name
  const seen = new Set();
  const nodes = allNodes.filter((n) => {
    if (seen.has(n.name)) return false;
    seen.add(n.name);
    return true;
  });

  const center = { x: 200, y: 175 };
  const radius = 130;
  const outerNodes = nodes.filter((n) => !n.isCenter);
  const nodePositions = outerNodes.map((n, i) => {
    const angle = (i / Math.max(outerNodes.length, 1)) * 2 * Math.PI - Math.PI / 2;
    return { ...n, x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) };
  });

  return (
    <div className="space-y-4">
      {/* Collusion probability */}
      <div className={`rounded-xl border p-4 ${collusion > 0.5 ? "bg-red-50 border-red-200" : collusion > 0 ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200"}`}>
        <div className="flex items-center gap-2.5">
          <AlertTriangle className={`w-5 h-5 ${collusion > 0.5 ? "text-red-600" : collusion > 0 ? "text-amber-600" : "text-emerald-600"}`} />
          <div>
            <p className="text-sm font-semibold text-slate-800">Collusion Probability: {(collusion * 100).toFixed(0)}%</p>
            <p className="text-xs text-slate-500">
              {collusion > 0.5 ? "High — shared identifiers detected with other entities" : collusion > 0 ? "Moderate — some shared identifiers found" : "Low — no shared identifiers detected"}
            </p>
          </div>
        </div>
      </div>

      {/* Network Graph SVG */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Network className="w-4 h-4 text-slate-500" />
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Relationship & Link Map</h4>
        </div>
        {nodes.length <= 1 ? (
          <div className="text-center py-10">
            <Share2 className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <p className="text-sm text-slate-400">No linked entities or shared identifiers found</p>
          </div>
        ) : (
          <svg viewBox="0 0 400 350" className="w-full max-w-md mx-auto">
            {/* Edges */}
            {nodePositions.map((n, i) => (
              <line key={`edge-${i}`} x1={center.x} y1={center.y} x2={n.x} y2={n.y}
                stroke={n.sharedType ? "#ef4444" : "#cbd5e1"} strokeWidth={n.sharedType ? 2 : 1} strokeDasharray={n.sharedType ? "4 2" : "none"} />
            ))}
            {/* Center node */}
            <circle cx={center.x} cy={center.y} r={28} fill={RISK_COLORS[profile.risk_level] || "#94a3b8"} opacity={0.9} />
            <text x={center.x} y={center.y + 4} textAnchor="middle" className="fill-white text-[9px] font-bold">
              {profile.legal_name?.slice(0, 12)}
            </text>
            {/* Outer nodes */}
            {nodePositions.map((n, i) => (
              <g key={`node-${i}`}>
                <circle cx={n.x} cy={n.y} r={18} fill={n.sharedType ? "#fef2f2" : "#f1f5f9"} stroke={n.sharedType ? "#ef4444" : "#94a3b8"} strokeWidth={1.5} />
                <text x={n.x} y={n.y + 3} textAnchor="middle" className="fill-slate-700 text-[7px] font-medium">
                  {n.name?.slice(0, 10)}
                </text>
                {n.txnCount && <text x={n.x} y={n.y + 28} textAnchor="middle" className="fill-slate-400 text-[7px]">{n.txnCount} txns</text>}
                {n.sharedType && <text x={n.x} y={n.y + 28} textAnchor="middle" className="fill-red-500 text-[7px] font-medium">shared {n.sharedType}</text>}
              </g>
            ))}
          </svg>
        )}
      </div>

      {/* Shared Identifiers List */}
      {shared.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Shared Identifiers with Other Entities</h4>
          <div className="space-y-2">
            {shared.map((s, i) => (
              <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-red-50/40 border border-red-100">
                <div>
                  <p className="text-xs font-medium text-slate-700">{s.entity}</p>
                  <p className="text-[10px] text-slate-400 capitalize">Shared {s.type.replace(/_/g, " ")}: {s.value}</p>
                </div>
                <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Linked Counterparties */}
      {counterparties.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Linked Counterparties (Buyer-Supplier)</h4>
          <div className="space-y-2">
            {counterparties.map((cp, i) => (
              <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50/60 border border-slate-100">
                <p className="text-xs font-medium text-slate-700">{cp.name}</p>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span>{cp.transaction_count} txns</span>
                  <span className="tabular-nums">{cp.total_value?.toLocaleString?.() || 0}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}