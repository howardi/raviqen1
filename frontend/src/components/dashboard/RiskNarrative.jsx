import React from "react";
import { Brain, Sparkles, Loader2, ArrowRight, AlertTriangle, ShieldCheck, TrendingUp } from "lucide-react";

const severityConfig = {
  low: { label: "Low", icon: ShieldCheck, classes: "from-emerald-500/10 to-emerald-500/5", ring: "ring-emerald-200", dot: "bg-emerald-500", text: "text-emerald-700" },
  medium: { label: "Medium", icon: TrendingUp, classes: "from-amber-500/10 to-orange-500/5", ring: "ring-amber-200", dot: "bg-amber-500", text: "text-amber-700" },
  high: { label: "High", icon: AlertTriangle, classes: "from-orange-500/10 to-amber-500/5", ring: "ring-orange-200", dot: "bg-orange-500", text: "text-orange-700" },
  critical: { label: "Critical", icon: AlertTriangle, classes: "from-red-500/10 to-rose-500/5", ring: "ring-red-200", dot: "bg-red-500", text: "text-red-700" },
};

export default function RiskNarrative({ narrative, recommendation, severity = "low", loading, onRegenerate }) {
  const conf = severityConfig[severity] || severityConfig.low;
  const ToneIcon = conf.icon;

  return (
    <div className={`relative overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-r ${conf.classes} ring-1 ${conf.ring}`}>
      <div className="flex items-start gap-4 p-5">
        <div className="shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-slate-900 to-slate-700 flex items-center justify-center shadow-sm">
          {loading ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Brain className="w-5 h-5 text-white" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <h3 className="text-sm font-bold text-[#231F20]">AI Risk Briefing</h3>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${conf.text} bg-white/70`}>
              <ToneIcon className="w-3 h-3" />
              {conf.label}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">Auto-generated from live data</span>
          </div>
          {loading ? (
            <div className="space-y-2">
              <div className="h-3.5 w-full max-w-2xl bg-slate-200/70 rounded animate-pulse" />
              <div className="h-3.5 w-3/4 max-w-xl bg-slate-200/70 rounded animate-pulse" />
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-700 leading-relaxed">{narrative}</p>
              {recommendation && (
                <div className="mt-2.5 flex items-start gap-1.5 text-xs text-slate-600">
                  <ArrowRight className="w-3.5 h-3.5 mt-0.5 text-slate-400 shrink-0" />
                  <span><span className="font-semibold text-slate-800">Recommended: </span>{recommendation}</span>
                </div>
              )}
            </>
          )}
        </div>
        <button
          onClick={onRegenerate}
          disabled={loading}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white/80 text-xs font-medium text-slate-600 hover:bg-white disabled:opacity-50 transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5" />
          {loading ? "Analyzing..." : "Refresh"}
        </button>
      </div>
    </div>
  );
}