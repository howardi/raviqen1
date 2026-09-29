import React from "react";
import { BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer, Tooltip } from "recharts";

export default function RiskFactorsChart({ factors = [], composite = 0 }) {
  const data = factors.filter((f) => f.score != null && f.reason).sort((a, b) => b.score - a.score);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-1">
        <div>
          <h3 className="text-sm font-semibold text-[#231F20]">Risk Factors</h3>
          <p className="text-xs text-slate-400">Weighted contribution to Risk Health score</p>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-[#231F20] leading-none">{composite == null ? "Not scored" : composite}</div>
          <div className="text-[10px] text-slate-400">composite</div>
        </div>
      </div>

      {data.length > 0 && <div className="h-[180px] w-full mt-3">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 28, left: 8, bottom: 0 }}>
            <XAxis type="number" domain={[0, 100]} hide />
            <YAxis
              type="category"
              dataKey="label"
              tick={{ fontSize: 11, fill: "#475569" }}
              axisLine={false}
              tickLine={false}
              width={110}
            />
            <Tooltip
              cursor={{ fill: "#f8fafc" }}
              contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }}
              formatter={(v, _n, p) => [`${v}/100 (weight ${p.payload.weight}%)`, p.payload.label]}
            />
            <Bar dataKey="score" radius={[4, 4, 4, 4]} barSize={18}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>}

      <div className="mt-3 space-y-2">
        {factors.map((f) => (
          <div key={f.key} className="text-[11px] border-t border-slate-100 pt-2">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 font-medium text-slate-700">
                <span className="w-2 h-2 rounded-full" style={{ background: f.color }} />
                {f.label}
              </span>
              <span className="font-medium text-slate-700 shrink-0">{f.score == null ? "Not scored" : `${f.score}/100 · ${f.weight}%`}</span>
            </div>
            <p className="mt-1 text-slate-500 leading-relaxed">{f.reason}</p>
          </div>
        ))}
      </div>
    </div>
  );
}