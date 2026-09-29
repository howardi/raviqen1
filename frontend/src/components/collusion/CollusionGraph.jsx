import React, { useMemo } from "react";

const RISK_COLORS = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#f59e0b",
  low: "#10b981",
};

export default function CollusionGraph({ nodes, links, width = 640, height = 480 }) {
  const positions = useMemo(() => {
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) / 2 - 80;
    const pos = {};
    nodes.forEach((n, i) => {
      const angle = (i / nodes.length) * 2 * Math.PI - Math.PI / 2;
      pos[n.id] = {
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
      };
    });
    return pos;
  }, [nodes, width, height]);

  if (!nodes.length) {
    return (
      <div className="flex items-center justify-center h-96 text-sm text-slate-400">
        No vendor data to analyze
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <svg width={width} height={height} className="mx-auto">
        {/* Edges */}
        {links.map((l, i) => {
          const s = positions[l.source];
          const t = positions[l.target];
          if (!s || !t) return null;
          const midX = (s.x + t.x) / 2;
          const midY = (s.y + t.y) / 2;
          const color = l.confidence >= 70 ? "#ef4444" : l.confidence >= 50 ? "#f97316" : "#94a3b8";
          return (
            <g key={i}>
              <line
                x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                stroke={color}
                strokeWidth={l.confidence >= 50 ? 2.5 : 1.5}
                strokeOpacity={0.5}
                strokeDasharray={l.confidence >= 70 ? "0" : "4 3"}
              />
              {l.confidence >= 50 && (
                <text x={midX} y={midY - 4} textAnchor="middle" className="text-[9px] fill-slate-500 font-medium">
                  {Math.round(l.confidence)}%
                </text>
              )}
            </g>
          );
        })}

        {/* Nodes */}
        {nodes.map((n) => {
          const p = positions[n.id];
          if (!p) return null;
          const color = RISK_COLORS[n.riskLevel] || RISK_COLORS.low;
          const r = n.linkCount >= 3 ? 22 : n.linkCount >= 1 ? 18 : 14;
          const label = n.label.length > 18 ? n.label.slice(0, 16) + "…" : n.label;
          return (
            <g key={n.id}>
              {n.linkCount >= 2 && (
                <circle cx={p.x} cy={p.y} r={r + 6} fill={color} opacity={0.15} />
              )}
              <circle cx={p.x} cy={p.y} r={r} fill={color} opacity={0.9} stroke="white" strokeWidth={2} />
              <text x={p.x} y={p.y + r + 14} textAnchor="middle" className="text-[10px] fill-slate-700 font-medium">
                {label}
              </text>
              {n.linkCount >= 1 && (
                <text x={p.x} y={p.y + 4} textAnchor="middle" className="text-[10px] fill-white font-bold">
                  {n.linkCount}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}