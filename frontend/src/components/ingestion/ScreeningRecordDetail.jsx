import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/currencyUtils";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import RiskBadge from "@/components/RiskBadge";
import FlagEvidenceTag from "@/components/FlagEvidenceTag";
import { Building2, ShieldCheck, Radar, Newspaper, AlertTriangle, ListChecks, FileWarning, Webhook, Copy, Check, ShoppingCart, BadgeCheck, FileCheck2, Sparkles } from "lucide-react";

function Section({ icon: Icon, title, children }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-slate-500" />
        <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">{title}</h4>
      </div>
      <div className="rounded-lg border border-slate-100 bg-slate-50/40 p-3 text-sm text-slate-700 space-y-1.5">
        {children}
      </div>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-xs text-slate-400 shrink-0">{label}</span>
      <span className="text-xs font-medium text-slate-700 text-right">{value || "—"}</span>
    </div>
  );
}

export default function ScreeningRecordDetail({ record, open, onOpenChange }) {
  if (!record) return null;
  const rec = record.normalized || {};
  const v = record.verification || {};
  const breakdown = record.risk_score?.breakdown || {};

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-base">Screening Detail</SheetTitle>
          <SheetDescription className="sr-only">Full breakdown for {rec.transaction_id}</SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-6 space-y-5">
          {/* Header summary */}
          <div className="flex items-center justify-between gap-3 p-4 rounded-xl bg-slate-50 border border-slate-100">
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#231F20] truncate">{rec.vendor}</p>
              <p className="text-xs text-slate-500 font-mono">{rec.transaction_id}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {record.risk_level === "not_scored" ? <span className="text-xs font-medium text-slate-600">Insufficient data · Not scored</span> : <RiskBadge level={record.risk_level} />}
              <span className={cn("inline-flex items-center justify-center w-10 h-10 rounded-full text-sm font-bold tabular-nums",
                record.risk_level === "not_scored" ? "bg-slate-100 text-slate-600" :
                record.risk_level === "critical" ? "bg-red-100 text-red-700" :
                record.risk_level === "high" ? "bg-orange-100 text-orange-700" :
                record.risk_level === "medium" ? "bg-amber-100 text-amber-700" :
                "bg-emerald-100 text-emerald-700"
              )}>
                {record.risk_score?.total ?? "—"}
              </span>
            </div>
          </div>

          {/* Normalized fields */}
          <Section icon={FileWarning} title="Extracted & Normalized Fields">
            <Field label="Transaction ID" value={rec.transaction_id} />
            <Field label="Vendor" value={rec.vendor} />
            <Field label="Counterparty" value={rec.counterparty} />
            <Field label="Amount" value={formatCurrency(rec.amount, rec.currency)} />
            <Field label="Date" value={rec.transaction_date} />
            <Field label="Category" value={rec.category} />
            <Field label="Location" value={rec.location} />
            <Field label="Payment Method" value={rec.payment_method} />
            <Field label="Bank Account" value={rec.bank_account} />
            <Field label="Tax ID / TIN" value={rec.tax_id} />
          </Section>

          {/* Risk breakdown */}
          <Section icon={AlertTriangle} title="Composite Risk Breakdown (0–100)">
            <div className="space-y-2">
              {[
                { label: "Counterparty Risk", val: breakdown.counterparty, max: 30, color: "bg-blue-500" },
                { label: "Sanctions Risk", val: breakdown.sanctions, max: 30, color: "bg-red-500" },
                { label: "Adverse Media Risk", val: breakdown.adverse_media, max: 20, color: "bg-amber-500" },
                { label: "Anomaly Risk", val: breakdown.anomaly, max: 20, color: "bg-violet-500" },
                ...(breakdown.rule_escalation > 0 ? [{ label: "Source-backed rule escalation", val: breakdown.rule_escalation, max: 100, color: "bg-orange-500" }] : []),
              ].map((b) => (
                <div key={b.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-500">{b.label}</span>
                    <span className="font-medium text-slate-700 tabular-nums">{record.risk_level === "not_scored" ? "Not scored" : `${b.val}/${b.max}`}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all", b.color)} style={{ width: `${(b.val / b.max) * 100}%` }} />
                  </div>
                </div>
              ))}
              <div className="flex justify-between pt-1.5 border-t border-slate-200">
                <span className="text-xs font-semibold text-slate-700">Total Composite Score</span>
                <span className="text-sm font-bold text-slate-900 tabular-nums">{record.risk_score?.total ?? "—"}/100</span>
              </div>
            </div>
          </Section>

          {/* Vendor & Entity Verification */}
          <Section icon={Building2} title="Vendor & Entity Verification">
            <Field label="Vendor search indication (not independently verified)" value={v.vendor_verification?.legal_exists === false ? "No matching result found — unconfirmed" : v.vendor_verification?.legal_exists === true ? "Potential match — unconfirmed" : "Unconfirmed"} />
            <Field label="Vendor registry" value={v.vendor_verification?.registry} />
            <Field label="Vendor confidence" value={v.vendor_verification?.confidence} />
            <Field label="Counterparty search indication (not independently verified)" value={v.counterparty_verification?.legal_exists === false ? "No matching result found — unconfirmed" : v.counterparty_verification?.legal_exists === true ? "Potential match — unconfirmed" : "Unconfirmed"} />
            <Field label="Counterparty registry" value={v.counterparty_verification?.registry} />
            {v.vendor_verification?.notes && <p className="text-xs text-slate-500 italic pt-1">{v.vendor_verification.notes}</p>}
          </Section>

          {/* Sanctions & PEP */}
          <Section icon={ShieldCheck} title="Unverified watchlist search indications — independent check required">
            <Field label="Vendor sanctions" value={v.sanctions_check?.vendor_status} />
            <Field label="Counterparty sanctions" value={v.sanctions_check?.counterparty_status} />
            <Field label="Executive sanctions" value={v.sanctions_check?.executive_status} />
            <Field label="Vendor PEP" value={v.pep_check?.vendor_pep} />
            <Field label="Counterparty PEP" value={v.pep_check?.counterparty_pep} />
            {v.sanctions_check?.matched_lists?.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {v.sanctions_check.matched_lists.map((l, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-medium">{l}</span>
                ))}
              </div>
            )}
            {v.sanctions_check?.details && <p className="text-xs text-slate-500 italic pt-1">{v.sanctions_check.details}</p>}
          </Section>

          {/* OSINT Adverse Media */}
          <Section icon={Newspaper} title="OSINT & Adverse Media Scan">
            <Field label="Vendor risk" value={v.adverse_media?.vendor_risk} />
            <Field label="Counterparty risk" value={v.adverse_media?.counterparty_risk} />
            {v.adverse_media?.vendor_findings?.length > 0 && (
              <div className="pt-1 space-y-1">
                <p className="text-[10px] font-semibold text-slate-400 uppercase">Vendor findings:</p>
                {v.adverse_media.vendor_findings.map((f, i) => (
                  <p key={i} className="text-xs text-slate-600 flex gap-1.5"><span className="text-amber-500">•</span>{f}</p>
                ))}
              </div>
            )}
            {v.adverse_media?.counterparty_findings?.length > 0 && (
              <div className="pt-1 space-y-1">
                <p className="text-[10px] font-semibold text-slate-400 uppercase">Counterparty findings:</p>
                {v.adverse_media.counterparty_findings.map((f, i) => (
                  <p key={i} className="text-xs text-slate-600 flex gap-1.5"><span className="text-amber-500">•</span>{f}</p>
                ))}
              </div>
            )}
            {v.adverse_media?.summary && <p className="text-xs text-slate-500 italic pt-1">{v.adverse_media.summary}</p>}
          </Section>

          {/* Anomaly Detection — each flag is expandable to show its evidence */}
          <Section icon={Radar} title="Transaction Anomaly Detection">
            {record.anomaly?.flags?.length > 0 ? (
              <div className="space-y-2">
                {record.anomaly.flags.map((flag, i) => {
                  const ev = (record.flag_evidence || []).find((e) => e.flag === flag);
                  return (
                    <div key={i} className="flex items-start gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-700">{flag}</p>
                        {record.anomaly.details?.[i] && <p className="text-[11px] text-slate-400">{record.anomaly.details[i]}</p>}
                        {ev && (
                          <div className="mt-1 text-[10px] text-slate-500 bg-slate-100 rounded px-2 py-1 leading-snug">
                            <span className="font-mono text-slate-400">{ev.rule_id}</span>
                            {" · "}Field: <span className="font-medium text-slate-600">{ev.evidence_field}</span>
                            {" · "}Value: <span className="font-medium text-slate-600">&ldquo;{ev.evidence_value}&rdquo;</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-emerald-600 flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" /> No anomalies detected</p>
            )}
          </Section>

          {/* Contextual False-Positive Analysis */}
          {record.contextual?.clearanceLabel && (
            <ContextualAnalysisSection ctx={record.contextual} />
          )}

          {/* Next Steps */}
          <Section icon={ListChecks} title="Actionable Next Steps">
            <div className="space-y-1.5">
              {record.next_steps?.map((step, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5",
                    i === 0 ? "bg-slate-800 text-white" : "bg-slate-200 text-slate-500")}>
                    {i + 1}
                  </span>
                  <p className="text-xs text-slate-700">{step}</p>
                </div>
              ))}
            </div>
          </Section>

          {v.overall_assessment && (
            <Section icon={FileWarning} title="AI Overall Assessment">
              <p className="text-xs text-slate-600 leading-relaxed">{v.overall_assessment}</p>
            </Section>
          )}

          {/* Procurement Pricing & Market Variance */}
          {record.procurement_variance && (
            <ProcurementVarianceSection pv={record.procurement_variance} />
          )}

          {/* Advanced Threats (Phase 3) */}
          {record.advanced_threats?.flags?.length > 0 && (
            <Section icon={AlertTriangle} title="Advanced Threat Detection (True Anomalies)">
              <div className="space-y-1.5">
                {record.advanced_threats.flags.map((flag, i) => {
                  const ev = (record.flag_evidence || []).find((e) => e.flag === flag);
                  return (
                    <div key={i} className="flex items-start gap-2">
                      <span className="px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-mono font-bold shrink-0">
                        {(record.advanced_threats.rules?.[i]?.rule_id) || "THREAT"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-red-700">{flag}</p>
                        {record.advanced_threats.details?.[i] && <p className="text-[11px] text-slate-500">{record.advanced_threats.details[i]}</p>}
                        {ev && (
                          <div className="mt-1 text-[10px] text-slate-500 bg-red-50 rounded px-2 py-1 leading-snug">
                            Field: <span className="font-medium text-slate-600">{ev.evidence_field}</span>
                            {" · "}Value: <span className="font-medium text-slate-600">&ldquo;{ev.evidence_value}&rdquo;</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          {/* Ledger Integration Payload (Phase 4) */}
          {record.ledger_payload && (
            <LedgerPayloadSection payload={record.ledger_payload} cleared={record.ledger_payload.ledger_action?.clear_for_disbursement} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

const CLEARANCE_STYLES = {
  "GENUINE B2B OUTLIER - CLEARED BY LOGIC": { icon: BadgeCheck, classes: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  "Verified Business Operations - Cleared by Logic": { icon: BadgeCheck, classes: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  "APPROVED_BY_CONTRACT": { icon: FileCheck2, classes: "bg-blue-100 text-blue-700 border-blue-200" },
  "VERIFIED ENTERPRISE - LOW RISK": { icon: ShieldCheck, classes: "bg-emerald-100 text-emerald-700 border-emerald-200" },
};

function ContextualAnalysisSection({ ctx }) {
  const label = ctx.clearanceLabel;
  const style = CLEARANCE_STYLES[label] || { icon: Sparkles, classes: "bg-slate-100 text-slate-700 border-slate-200" };
  const CIcon = style.icon;
  return (
    <Section icon={BadgeCheck} title="Contextual False-Positive Analysis">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border", style.classes)}>
            <CIcon className="w-3.5 h-3.5" />
            {label}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Contextual Score</span>
            <span className="text-sm font-bold tabular-nums text-slate-800">{ctx.contextualScore ?? 0}/100</span>
          </div>
        </div>
        {(ctx.entityAligned || ctx.verifiedEnterprise) && (
          <div className="flex items-center gap-2 flex-wrap">
            {ctx.entityAligned && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[11px] font-medium border border-emerald-100">
                <ShieldCheck className="w-3 h-3" /> Entity Aligned
              </span>
            )}
            {ctx.verifiedEnterprise && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[11px] font-medium border border-blue-100">
                <BadgeCheck className="w-3 h-3" /> Verified Enterprise
              </span>
            )}
            {ctx.approvedByContract && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[11px] font-medium border border-blue-100">
                <FileCheck2 className="w-3 h-3" /> Approved by Contract
              </span>
            )}
            {ctx.genuineB2BOutlier && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[11px] font-medium border border-emerald-100">
                <BadgeCheck className="w-3 h-3" /> Genuine B2B Outlier
              </span>
            )}
          </div>
        )}
        {ctx.notes?.length > 0 && (
          <div className="space-y-1.5 pt-1 border-t border-slate-100">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Suppression / Clearance Rationale</p>
            {ctx.notes.map((note, i) => (
              <p key={i} className="text-xs text-slate-600 flex gap-1.5 leading-relaxed">
                <span className="text-emerald-500 shrink-0">•</span>{note}
              </p>
            ))}
          </div>
        )}
      </div>
    </Section>
  );
}

function LedgerPayloadSection({ payload, cleared }) {
  const [copied, setCopied] = useState(false);
  const json = JSON.stringify(payload, null, 2);
  const copy = async () => {
    try { await navigator.clipboard.writeText(json); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch (e) { /* ignore */ }
  };
  return (
    <Section icon={Webhook} title="Ledger Integration Payload (Webhook)">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium",
            cleared ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700")}>
            {cleared ? <Check className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
            {cleared ? "STATE A — CLEARED → update_record" : "STATE B — QUARANTINED → quarantine_record"}
          </span>
          <button onClick={copy} className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800">
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? "Copied" : "Copy JSON"}
          </button>
        </div>
        <pre className="text-[11px] font-mono text-slate-700 bg-slate-900 text-slate-100 rounded-lg p-3 overflow-x-auto leading-relaxed">{json}</pre>
      </div>
    </Section>
  );
}

const PG_STYLES = {
  "RULE-PG-01": { badge: "bg-emerald-100 text-emerald-700", tone: "text-emerald-600" },
  "RULE-PG-02": { badge: "bg-amber-100 text-amber-700", tone: "text-amber-600" },
  "RULE-PG-03": { badge: "bg-red-100 text-red-700", tone: "text-red-600" },
};

function ProcurementVarianceSection({ pv }) {
  const overall = pv.overall_procurement_risk || "LOW";
  const overallTone =
    overall === "CRITICAL" ? "bg-red-50 text-red-700 border-red-200" :
    overall === "MEDIUM" ? "bg-amber-50 text-amber-700 border-amber-200" :
    "bg-emerald-50 text-emerald-700 border-emerald-200";
  return (
    <Section icon={ShoppingCart} title="Procurement Market Variance (Nigerian Pricing)">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border", overallTone)}>
            Overall Procurement Risk: {overall}
          </span>
          <span className="text-[10px] text-slate-400">{pv.fx_basis}</span>
        </div>

        <div className="space-y-2">
          {(pv.market_variance_analysis || []).map((item, i) => {
            const st = PG_STYLES[item.flagged_rule] || PG_STYLES["RULE-PG-01"];
            return (
              <div key={i} className="rounded-lg border border-slate-200 bg-white p-2.5 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-medium text-slate-800 leading-snug">{item.item_description}</p>
                  <span className={cn("px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold shrink-0", st.badge)}>
                    {item.flagged_rule}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                  <div className="flex justify-between"><span className="text-slate-400">Invoice:</span><span className="font-medium text-slate-700">{item.invoice_unit_price}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Market avg:</span><span className="font-medium text-slate-700">{item.nigerian_market_avg}</span></div>
                  <div className="flex justify-between col-span-2"><span className="text-slate-400">Variance:</span><span className={cn("font-bold", st.tone)}>{item.calculated_variance_percent}</span></div>
                </div>
                <p className={cn("text-[11px] font-medium", st.tone)}>{item.status}</p>
              </div>
            );
          })}
        </div>

        <div className="pt-1 border-t border-slate-200">
          <p className="text-[10px] font-semibold text-slate-400 uppercase">Recommended Action</p>
          <p className="text-xs text-slate-700 mt-0.5">{pv.recommended_action}</p>
        </div>
      </div>
    </Section>
  );
}