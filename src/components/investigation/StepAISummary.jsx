import React from "react";
import { Brain, Sparkles, Loader2, Quote } from "lucide-react";

const confidenceConfig = {
  high: { label: "High Confidence", color: "text-emerald-600", bg: "bg-emerald-50", dot: "bg-emerald-500" },
  medium: { label: "Medium Confidence", color: "text-amber-600", bg: "bg-amber-50", dot: "bg-amber-500" },
  low: { label: "Low Confidence", color: "text-slate-500", bg: "bg-slate-100", dot: "bg-slate-400" },
};

export default function StepAISummary({ summary, confidence, citedSignals, generating, onGenerate, acknowledged, onAcknowledge }) {
  const conf = confidenceConfig[confidence] || confidenceConfig.medium;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-bold text-[#231F20]">Step 2 — AI Grounded Risk Summary</h2>
        <p className="text-xs text-slate-500">AI-generated explanation citing specific evidence signals · Grounding Standard compliant</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-violet-600/5 to-indigo-600/5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-700 flex items-center justify-center">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#231F20]">Grounded Risk Summary</h3>
              <p className="text-xs text-slate-400">Traceable to source data</p>
            </div>
          </div>
          <button
            onClick={onGenerate}
            disabled={generating}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {generating ? "Analyzing..." : summary ? "Regenerate" : "Generate Summary"}
          </button>
        </div>

        <div className="p-5">
          {summary ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${conf.bg} ${conf.color}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${conf.dot}`} />
                  {conf.label}
                </span>
              </div>
              <div className="relative pl-4 border-l-2 border-violet-200">
                <Quote className="absolute -left-1.5 top-0 w-3 h-3 text-violet-300 bg-white" />
                <p className="text-sm text-slate-700 leading-relaxed">{summary}</p>
              </div>
              {citedSignals?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-2">Cited Evidence Signals:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {citedSignals.map((s, i) => (
                      <span key={i} className="text-[11px] font-medium px-2 py-1 rounded bg-violet-50 text-violet-700 border border-violet-100">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <label className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                <input type="checkbox" checked={acknowledged} onChange={(e) => onAcknowledge?.(e.target.checked)} className="accent-slate-900" />
                <span className="text-xs font-medium text-slate-700">I have reviewed the AI risk summary and understand the cited evidence.</span>
              </label>
            </div>
          ) : (
            <div className="text-center py-10">
              <Brain className="w-10 h-10 mx-auto text-slate-200 mb-3" />
              <p className="text-sm text-slate-400">
                {generating ? "AI is analyzing the evidence signals..." : "Click \"Generate Summary\" to produce a grounded AI risk assessment."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function isStep2Complete(summary, acknowledged) {
  return !!summary && acknowledged;
}