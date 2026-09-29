import React from "react";
import { Brain, ShieldCheck, Scale, DollarSign, Lightbulb, GitCompare, MessageSquare, FileText, AlertTriangle, CheckCircle2 } from "lucide-react";
import RiskBadge from "@/components/RiskBadge";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/currencyUtils";

const confidenceConfig = {
  high: { label: "High", color: "text-emerald-600", bg: "bg-emerald-50" },
  medium: { label: "Medium", color: "text-amber-600", bg: "bg-amber-50" },
  low: { label: "Low", color: "text-slate-500", bg: "bg-slate-100" },
};

const outcomeLabels = {
  pending: "Pending — still reviewing",
  confirmed_anomaly: "Confirmed anomaly",
  false_positive: "False positive",
  process_error: "Process error",
  escalated: "Escalated to senior team",
};

const complianceColor = {
  critical: "text-red-700 bg-red-50 border-red-200",
  high: "text-orange-700 bg-orange-50 border-orange-200",
  medium: "text-amber-700 bg-amber-50 border-amber-200",
  low: "text-slate-600 bg-slate-50 border-slate-200",
};

const impactColor = {
  minimal: "text-emerald-600",
  moderate: "text-amber-600",
  significant: "text-orange-600",
  severe: "text-red-600",
};

function Section({ icon: Icon, number, title, children, empty }) {
  return (
    <div className="border-b border-slate-100 last:border-b-0">
      <div className="flex items-center gap-2 px-6 py-3 bg-slate-50/60 sticky top-0">
        <div className="w-6 h-6 rounded bg-slate-900 text-white text-[10px] font-bold flex items-center justify-center">{number}</div>
        <Icon className="w-3.5 h-3.5 text-slate-500" />
        <h3 className="text-xs font-bold text-[#231F20] uppercase tracking-wide">{title}</h3>
      </div>
      <div className="px-6 py-4">
        {empty ? <p className="text-xs text-slate-400 italic">{empty}</p> : children}
      </div>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex gap-3 py-1.5 text-xs">
      <span className="text-slate-400 w-32 shrink-0">{label}</span>
      <span className="text-slate-700 font-medium">{value || "—"}</span>
    </div>
  );
}

export default function ReportPreview({ reportData, narrative, generating }) {
  const r = reportData;
  const n = narrative || {};
  if (!r) return null;
  const conf = confidenceConfig[r.aiAssessment.confidence] || confidenceConfig.medium;
  const fmtMoney = (amt, cur) => formatCurrency(amt, cur || r.transaction?.currency);

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
      {/* Report Header */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 px-6 py-5 text-white">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 rounded bg-white/10 flex items-center justify-center">
                <ShieldCheck className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/70">RAVIQEN</span>
            </div>
            <h2 className="text-base font-bold leading-tight">{r.meta.title}</h2>
            <p className="text-[11px] text-white/60 font-mono mt-0.5">{r.meta.report_id} · {r.meta.transaction_id}</p>
          </div>
          <div className="text-right">
            <RiskBadge level={r.meta.risk_level} size="sm" />
            <p className="text-[10px] text-white/50 mt-1.5">{new Date(r.meta.generated_at || Date.now()).toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="max-h-[480px] overflow-y-auto">
        {/* 1. Executive Summary */}
        <Section icon={FileText} number={1} title="Executive Summary" empty={generating ? "Generating narrative..." : undefined}>
          <p className="text-xs text-slate-700 leading-relaxed">{n.executive_summary || <span className="italic text-slate-400">Click "Generate Narrative" to produce the executive summary.</span>}</p>
        </Section>

        {/* 2. Transaction Details */}
        <Section icon={FileText} number={2} title="Transaction Details">
          <div className="grid grid-cols-2 gap-x-4">
            <DetailRow label="Vendor" value={r.transaction.vendor} />
            <DetailRow label="Amount" value={fmtMoney(r.transaction.amount, r.transaction.currency)} />
            <DetailRow label="Date" value={r.transaction.date} />
            <DetailRow label="Payment" value={r.transaction.payment_method} />
            <DetailRow label="Location" value={r.transaction.location} />
            <DetailRow label="Category" value={r.transaction.category} />
          </div>
        </Section>

        {/* 3. Evidence & Anomaly Signals */}
        <Section icon={AlertTriangle} number={3} title="Evidence & Anomaly Signals" empty={!r.evidence.length ? "No evidence signals recorded" : undefined}>
          <div className="space-y-1.5">
            {r.evidence.map((e, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className={cn("w-1.5 h-1.5 rounded-full mt-1.5 shrink-0", e.severity === "critical" ? "bg-red-500" : e.severity === "high" ? "bg-orange-500" : e.severity === "medium" ? "bg-amber-500" : "bg-slate-400")} />
                <div><span className="font-medium text-slate-700">{e.label}:</span> <span className="text-slate-600">{e.value}</span></div>
              </div>
            ))}
          </div>
        </Section>

        {/* 4. AI Risk Assessment */}
        <Section icon={Brain} number={4} title="AI Risk Assessment" empty={!r.aiAssessment.summary ? "AI summary not generated" : undefined}>
          <div className="space-y-2">
            <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium", conf.bg, conf.color)}>
              {conf.label} Confidence
            </span>
            <p className="text-xs text-slate-700 leading-relaxed">{r.aiAssessment.summary}</p>
            {r.aiAssessment.cited_signals.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {r.aiAssessment.cited_signals.map((s, i) => (
                  <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 border border-violet-100">{s}</span>
                ))}
              </div>
            )}
          </div>
        </Section>

        {/* 5. Cross-Reference */}
        <Section icon={GitCompare} number={5} title="Source Data Cross-Reference" empty={!r.crossReference.length ? "No cross-reference records" : undefined}>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-100">
                <th className="py-1.5 font-medium">Source</th>
                <th className="py-1.5 font-medium">Type</th>
                <th className="py-1.5 font-medium">Vendor</th>
                <th className="py-1.5 font-medium text-right">Amount</th>
                <th className="py-1.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {r.crossReference.map((x, i) => (
                <tr key={i} className="border-b border-slate-50 last:border-b-0">
                  <td className="py-1.5 capitalize text-slate-600">{x.source_type}</td>
                  <td className="py-1.5 text-slate-600">{x.record_type}</td>
                  <td className="py-1.5 text-slate-700">{x.vendor}</td>
                  <td className="py-1.5 text-right text-slate-700 tabular-nums">{fmtMoney(x.amount)}</td>
                  <td className="py-1.5"><span className={cn("text-[10px] px-1.5 py-0.5 rounded capitalize", x.match_status === "matches" ? "bg-emerald-50 text-emerald-700" : x.match_status === "discrepancy" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500")}>{x.match_status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        {/* 6. Compliance Impact */}
        <Section icon={Scale} number={6} title="Compliance Impact Analysis" empty={!r.compliance ? "Compliance analysis not run" : undefined}>
          {r.compliance && (
            <div className="space-y-2">
              {r.compliance.frameworks?.map((f, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase shrink-0 mt-0.5", complianceColor[f.relevance] || complianceColor.low)}>{f.relevance}</span>
                  <div>
                    <p className="text-xs font-medium text-slate-700">{f.framework}</p>
                    <p className="text-[11px] text-slate-500">{f.potential_violation}</p>
                  </div>
                </div>
              ))}
              {r.compliance.overall_assessment && <p className="text-xs text-slate-600 pt-1 italic">{r.compliance.overall_assessment}</p>}
            </div>
          )}
        </Section>

        {/* 7. Financial Impact */}
        <Section icon={DollarSign} number={7} title="Financial Impact Estimation" empty={!r.financialImpact ? "Financial impact not estimated" : undefined}>
          {r.financialImpact && (
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <span className={cn("text-lg font-bold", impactColor[r.financialImpact.impact_category] || "text-slate-700")}>{fmtMoney(r.financialImpact.estimated_exposure)}</span>
                <span className="text-[10px] text-slate-400">est. exposure</span>
              </div>
              <p className="text-[11px] text-slate-500">Range: {fmtMoney(r.financialImpact.exposure_range_low)} – {fmtMoney(r.financialImpact.exposure_range_high)} · <span className="capitalize font-medium">{r.financialImpact.impact_category}</span></p>
              {r.financialImpact.factors?.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {r.financialImpact.factors.map((f, i) => <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{f}</span>)}
                </div>
              )}
              {r.financialImpact.mitigation_value && <p className="text-[11px] text-emerald-700 pt-1">✓ {r.financialImpact.mitigation_value}</p>}
            </div>
          )}
        </Section>

        {/* 8. Recommended Actions */}
        <Section icon={Lightbulb} number={8} title="Recommended Actions" empty={!r.recommendations.length ? "No recommendations generated" : undefined}>
          <div className="space-y-1.5">
            {r.recommendations.map((rec, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className="text-slate-400 font-mono shrink-0">{i + 1}.</span>
                <div>
                  <span className="text-[9px] font-bold uppercase px-1 py-0.5 rounded bg-slate-100 text-slate-600 mr-1.5">{rec.priority}</span>
                  <span className="text-slate-700 font-medium">{rec.action}</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">{rec.rationale}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* 9. Similar Cases */}
        <Section icon={GitCompare} number={9} title="Similar Cases Detected" empty={!r.similarCases.length ? "No similar cases detected" : undefined}>
          <div className="space-y-1.5">
            {r.similarCases.map((c, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-slate-700 truncate">{c.title}</span>
                <span className="text-violet-600 font-bold tabular-nums shrink-0 ml-2">{c.similarity_score}%</span>
              </div>
            ))}
          </div>
        </Section>

        {/* 10. Q&A Log */}
        <Section icon={MessageSquare} number={10} title="Investigator Q&A Log" empty={!r.qaHistory.length ? "No questions asked" : undefined}>
          <div className="space-y-2">
            {r.qaHistory.map((qa, i) => (
              <div key={i} className="text-xs">
                <p className="text-slate-700 font-medium">Q: {qa.question}</p>
                <p className="text-slate-600 mt-0.5">A: {qa.answer}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* 11. Investigator Notes */}
        <Section icon={FileText} number={11} title="Investigator Notes" empty={!r.notes ? "None recorded" : undefined}>
          <p className="text-xs text-slate-700 whitespace-pre-wrap">{r.notes}</p>
        </Section>

        {/* 12. Conclusion */}
        <Section icon={CheckCircle2} number={12} title="Conclusion & Outcome" empty={generating ? "Generating narrative..." : undefined}>
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700">
              {outcomeLabels[r.outcome] || r.outcome}
            </span>
            <p className="text-xs text-slate-700 leading-relaxed">{n.conclusion || <span className="italic text-slate-400">Click "Generate Narrative" to produce the conclusion.</span>}</p>
          </div>
        </Section>

        {/* 13. Audit Trail */}
        <Section icon={ShieldCheck} number={13} title="Audit Trail & Sign-off">
          <div className="space-y-1">
            <DetailRow label="Investigator" value={r.meta.investigator} />
            <DetailRow label="Created" value={r.meta.created_date ? new Date(r.meta.created_date).toLocaleString() : "—"} />
            <DetailRow label="Outcome" value={outcomeLabels[r.outcome] || r.outcome} />
            <DetailRow label="Generated by" value="RAVIQEN AI" />
          </div>
        </Section>
      </div>
    </div>
  );
}