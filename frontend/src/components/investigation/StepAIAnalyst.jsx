import React, { useState } from "react";
import {
  Sparkles, Loader2, MessageSquare, Send, Lightbulb, GitCompare, CheckCircle2, Circle, Search, Scale, DollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/currencyUtils";

const priorityConfig = {
  immediate: "bg-red-50 text-red-700 border-red-200",
  high: "bg-orange-50 text-orange-700 border-orange-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-slate-50 text-slate-600 border-slate-200",
};

const complianceColor = {
  critical: "bg-red-50 text-red-700 border-red-200",
  high: "bg-orange-50 text-orange-700 border-orange-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-slate-50 text-slate-600 border-slate-200",
};

const impactColor = {
  minimal: "text-emerald-600",
  moderate: "text-amber-600",
  significant: "text-orange-600",
  severe: "text-red-600",
};

function SectionCard({ icon: Icon, title, subtitle, gradient, children, action }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className={cn("flex items-center justify-between px-5 py-3.5 border-b border-slate-100", gradient)}>
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-slate-600" />
          <div>
            <h3 className="text-sm font-semibold text-[#231F20]">{title}</h3>
            {subtitle && <p className="text-[11px] text-slate-400">{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export default function StepAIAnalyst({
  recommendations, similarCases, qaHistory,
  loadingRecs, loadingSimilar, loadingQA,
  complianceAnalysis, financialImpact, loadingCompliance, loadingFinancial,
  onGenerateRecs, onGenerateSimilar, onAsk, onGenerateCompliance, onGenerateFinancial,
  currency,
}) {
  const [question, setQuestion] = useState("");
  const [acceptedRecs, setAcceptedRecs] = useState({});
  const fmtMoney = (amt) => formatCurrency(amt, currency);

  const handleAsk = () => {
    if (!question.trim()) return;
    onAsk(question.trim());
    setQuestion("");
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-bold text-[#231F20]">Step 4 — AI Analyst Suite</h2>
        <p className="text-xs text-slate-500">Recommended actions, similar-case detection, and natural-language Q&A — all grounded in source data</p>
      </div>

      {/* Recommended Actions */}
      <SectionCard
        icon={Lightbulb}
        title="Recommended Next Actions"
        subtitle="AI-suggested steps prioritized by urgency"
        gradient="bg-gradient-to-r from-violet-600/5 to-indigo-600/5"
        action={
          <button onClick={onGenerateRecs} disabled={loadingRecs} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium hover:bg-slate-50 disabled:opacity-50 transition-colors">
            {loadingRecs ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {loadingRecs ? "Generating..." : recommendations?.length ? "Regenerate" : "Generate"}
          </button>
        }
      >
        {recommendations?.length ? (
          <div className="space-y-2">
            {recommendations.map((rec, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-slate-100 hover:bg-slate-50/60 transition-colors">
                <button
                  onClick={() => setAcceptedRecs((p) => ({ ...p, [i]: !p[i] }))}
                  className="mt-0.5 shrink-0"
                >
                  {acceptedRecs[i] ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Circle className="w-4 h-4 text-slate-300" />}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded border uppercase tracking-wide", priorityConfig[rec.priority] || priorityConfig.low)}>
                      {rec.priority}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-slate-800">{rec.action}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{rec.rationale}</p>
                </div>
              </div>
            ))}
            <p className="text-[11px] text-slate-400 pt-1">{Object.values(acceptedRecs).filter(Boolean).length} of {recommendations.length} actions accepted</p>
          </div>
        ) : (
          <p className="text-sm text-slate-400 italic text-center py-6">Click "Generate" to get AI-recommended next actions.</p>
        )}
      </SectionCard>

      {/* Advanced: Compliance + Financial Impact */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Compliance Impact */}
        <SectionCard
          icon={Scale}
          title="Compliance Impact Analysis"
          subtitle="Regulatory framework mapping"
          gradient="bg-gradient-to-r from-rose-600/5 to-red-600/5"
          action={
            <button onClick={onGenerateCompliance} disabled={loadingCompliance} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-medium hover:bg-slate-50 disabled:opacity-50 transition-colors">
              {loadingCompliance ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {loadingCompliance ? "..." : complianceAnalysis ? "Regenerate" : "Analyze"}
            </button>
          }
        >
          {complianceAnalysis?.frameworks?.length ? (
            <div className="space-y-2.5">
              {complianceAnalysis.frameworks.map((f, i) => (
                <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-100 bg-slate-50/40">
                  <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase shrink-0 mt-0.5", complianceColor[f.relevance] || complianceColor.low)}>{f.relevance}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-800">{f.framework}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{f.potential_violation}</p>
                  </div>
                </div>
              ))}
              {complianceAnalysis.overall_assessment && (
                <p className="text-[11px] text-slate-600 italic pt-1 border-t border-slate-100">{complianceAnalysis.overall_assessment}</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-400 italic text-center py-6">{loadingCompliance ? "Mapping to frameworks..." : "Click \"Analyze\" to map this transaction to compliance frameworks."}</p>
          )}
        </SectionCard>

        {/* Financial Impact */}
        <SectionCard
          icon={DollarSign}
          title="Financial Impact Estimation"
          subtitle="Exposure and loss potential"
          gradient="bg-gradient-to-r from-emerald-600/5 to-teal-600/5"
          action={
            <button onClick={onGenerateFinancial} disabled={loadingFinancial} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-medium hover:bg-slate-50 disabled:opacity-50 transition-colors">
              {loadingFinancial ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {loadingFinancial ? "..." : financialImpact ? "Regenerate" : "Estimate"}
            </button>
          }
        >
          {financialImpact ? (
            <div className="space-y-3">
              <div>
                <div className="flex items-baseline gap-2">
                  <span className={cn("text-2xl font-bold tabular-nums", impactColor[financialImpact.impact_category] || "text-slate-700")}>{fmtMoney(financialImpact.estimated_exposure)}</span>
                  <span className="text-[11px] text-slate-400">est. exposure</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">Range: {fmtMoney(financialImpact.exposure_range_low)} – {fmtMoney(financialImpact.exposure_range_high)} · <span className="capitalize font-medium">{financialImpact.impact_category}</span></p>
              </div>
              {financialImpact.factors?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {financialImpact.factors.map((f, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600">{f}</span>
                  ))}
                </div>
              )}
              {financialImpact.mitigation_value && (
                <p className="text-[11px] text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-100">✓ {financialImpact.mitigation_value}</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-400 italic text-center py-6">{loadingFinancial ? "Calculating exposure..." : "Click \"Estimate\" to project financial exposure."}</p>
          )}
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Similar Cases */}
        <SectionCard
          icon={GitCompare}
          title="Similar Cases Detected"
          subtitle="Historically similar flagged transactions"
          action={
            <button onClick={onGenerateSimilar} disabled={loadingSimilar} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-medium hover:bg-slate-50 disabled:opacity-50 transition-colors">
              {loadingSimilar ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              {loadingSimilar ? "..." : "Detect"}
            </button>
          }
        >
          {similarCases?.length ? (
            <div className="space-y-2.5">
              {similarCases.map((c, i) => (
                <div key={i} className="p-3 rounded-lg border border-slate-100 bg-slate-50/40">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-slate-700 truncate">{c.title}</span>
                    <span className="text-xs font-bold text-violet-600 tabular-nums shrink-0 ml-2">{c.similarity_score}%</span>
                  </div>
                  <p className="text-[11px] text-slate-500">{c.reason}</p>
                  <div className="mt-1.5 h-1 rounded-full bg-slate-200 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-violet-400 to-indigo-500 rounded-full" style={{ width: `${c.similarity_score}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 italic text-center py-6">{loadingSimilar ? "Analyzing history..." : "Click \"Detect\" to find similar cases."}</p>
          )}
        </SectionCard>

        {/* Q&A */}
        <SectionCard
          icon={MessageSquare}
          title="Ask the AI Analyst"
          subtitle="Natural-language questions about this transaction"
        >
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAsk()}
              placeholder="e.g. Why was this flagged as critical?"
              className="flex-1 text-sm px-3 py-2 rounded-lg border border-slate-200 focus:border-slate-400 focus:ring-1 focus:ring-slate-300 outline-none"
            />
            <button onClick={handleAsk} disabled={loadingQA || !question.trim()} className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 transition-colors shrink-0">
              {loadingQA ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
          <div className="space-y-2.5 max-h-64 overflow-y-auto">
            {qaHistory?.length ? (
              qaHistory.map((qa, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex gap-2 justify-end">
                    <span className="text-xs bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg rounded-tr-sm max-w-[80%]">{qa.question}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-xs bg-violet-50 text-slate-700 px-3 py-1.5 rounded-lg rounded-tl-sm max-w-[85%] border border-violet-100">{qa.answer}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400 italic text-center py-4">Ask a question to get a grounded answer.</p>
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}