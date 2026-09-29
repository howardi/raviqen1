import React from "react";
import { FileText, CheckCircle2, AlertTriangle, Ban, ShieldAlert, ListChecks } from "lucide-react";

const RULES = [
  { id: "RULE-BE-01", label: "Personal Account on Corporate Invoice", level: "High" },
  { id: "RULE-HV-02", label: "High-Value Outlier / Non-Standard Terms", level: "High" },
  { id: "RULE-BS-03", label: "Standard Baseline (Settled Receipt)", level: "Low" },
];

export default function RiskBriefingCard({ briefing }) {
  if (!briefing) return null;
  const { totalParsed, validEntries, flaggedAnomalies, quarantined, ruleBreakdown, recommendedMitigation, contextual } = briefing;
  const ctx = contextual || { entityMatchCount: 0, avgContextualScore: 0 };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <ShieldAlert className="w-4 h-4 text-slate-700" />
        <h3 className="text-sm font-semibold text-[#231F20]">Risk Briefing Summary</h3>
        <span className="ml-auto text-[10px] font-mono text-slate-400">RAVIQEN Engine v2.4</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Stat icon={FileText} label="Total Parsed" value={totalParsed} tone="slate" />
        <Stat icon={CheckCircle2} label="Valid Entries" value={validEntries} tone="emerald" />
        <Stat icon={AlertTriangle} label="Flagged Anomalies" value={flaggedAnomalies} tone="amber" />
        <Stat icon={Ban} label="Quarantined" value={quarantined} tone="red" />
      </div>

      <div className="flex items-center gap-3 flex-wrap p-3 rounded-lg bg-slate-50 border border-slate-200 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Contextual Risk Score</span>
          <span className="text-sm font-bold tabular-nums text-slate-800">{ctx.avgContextualScore ?? "Not scored"}</span>
        </div>
        <div className="h-4 w-px bg-slate-200" />
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-medium">
          <CheckCircle2 className="w-3 h-3" /> {ctx.entityMatchCount} source name matches (identity unverified)
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Mandatory Rule Flags</p>
          <div className="space-y-2">
            {RULES.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <div className="min-w-0">
                  <p className="text-xs font-mono font-semibold text-slate-700">{r.id}</p>
                  <p className="text-[11px] text-slate-500 truncate">{r.label}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-bold tabular-nums text-slate-800">{ruleBreakdown[r.id] || 0}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${r.level === "High" ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
                    {r.level}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Recommended Mitigation Steps</p>
          {recommendedMitigation.length === 0 ? (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-100">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <p className="text-xs text-emerald-700">No high-risk rule triggers in available source fields; external checks remain unverified.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {recommendedMitigation.map((m, i) => (
                <li key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-100">
                  <ListChecks className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-800">{m}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    red: "bg-red-100 text-red-700",
  };
  return (
    <div className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-100 bg-slate-50/50">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${tones[tone]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-lg font-bold text-[#231F20] tabular-nums leading-none">{value}</p>
        <p className="text-[10px] text-slate-400 uppercase tracking-wide mt-1">{label}</p>
      </div>
    </div>
  );
}