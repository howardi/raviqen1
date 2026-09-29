import React from "react";
import { Link } from "react-router-dom";
import { FileSearch, ArrowRight, Sparkles, ShieldAlert, Lightbulb } from "lucide-react";
import RiskBadge from "@/components/RiskBadge";
import MarkdownContent from "@/components/MarkdownContent";

export default function CaseBriefing({ investigation }) {
  if (!investigation) return null;
  const briefing = investigation.ai_explanation || "";
  const steps = investigation.recommended_actions || [];
  const signals = investigation.cited_signals || [];

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
            <FileSearch className="w-4.5 h-4.5 text-violet-600" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#231F20] truncate">{investigation.title}</p>
            <p className="text-xs text-slate-400">{investigation.vendor} · {new Date(investigation.created_date).toLocaleDateString()}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <RiskBadge level={investigation.risk_level} size="sm" />
          <Link to={`/investigations/${investigation.id}`} className="text-xs text-slate-600 hover:text-slate-900 inline-flex items-center gap-1 font-medium">
            Open <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* AI Executive Briefing */}
        {briefing && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-violet-500" />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">AI Executive Briefing</span>
            </div>
            <div className="text-sm text-slate-700 leading-relaxed bg-violet-50/40 rounded-lg p-3 border border-violet-100">
              <MarkdownContent content={briefing} />
            </div>
          </div>
        )}

        {/* Cited Signals */}
        {signals.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Cited Signals ({signals.length})</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {signals.map((s, i) => (
                <span key={i} className="px-2 py-1 rounded-lg bg-amber-50 border border-amber-100 text-xs text-amber-700">{s}</span>
              ))}
            </div>
          </div>
        )}

        {/* Recommended Next Steps */}
        {steps.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Lightbulb className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Recommended Next Steps</span>
            </div>
            <div className="space-y-1.5">
              {steps.map((s, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                  <span>{typeof s === "string" ? s : s.action}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Evidence Summary */}
        {investigation.evidence_summary && (
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Evidence Summary</span>
            <p className="text-xs text-slate-600 mt-1 whitespace-pre-line">{investigation.evidence_summary}</p>
          </div>
        )}
      </div>
    </div>
  );
}