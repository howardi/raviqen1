import React, { useState } from "react";
import { ChevronDown, ChevronRight, Copy, Check, ShieldCheck, ShieldAlert, AlertTriangle, Ban, Calculator, Building2, Phone, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/currencyUtils";

function levelTone(level) {
  const l = String(level || "").toUpperCase();
  if (l === "CRITICAL") return { cls: "bg-red-100 text-red-700 border-red-200", dot: "bg-red-500" };
  if (l === "HIGH") return { cls: "bg-orange-100 text-orange-700 border-orange-200", dot: "bg-orange-500" };
  if (l === "MEDIUM") return { cls: "bg-amber-100 text-amber-700 border-amber-200", dot: "bg-amber-500" };
  return { cls: "bg-emerald-100 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" };
}

export default function MasterRiskEventCard({ event }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const p = event.payload;
  const cf = p.cleansed_financials;
  const cm = p.cleansed_metadata;
  const rec = p.risk_engine_correction;
  const safe = rec.action === "FORCE_OVERRIDE" || rec.final_risk_level === "LOW";
  const tone = levelTone(rec.final_risk_level);
  const StatusIcon = safe ? ShieldCheck : ShieldAlert;
  const mathOk = event.override || !(event.score >= 45 && /math/i.test(rec.system_note));
  const closed = rec.close_legacy_alerts || [];

  const copy = () => {
    navigator.clipboard?.writeText(JSON.stringify(p, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex items-start gap-3 p-4">
        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border", safe ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200")}>
          <StatusIcon className="w-4.5 h-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-[#231F20] truncate">{p.vendor_name}</p>
            <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold", tone.cls)}>
              <StatusIcon className="w-3 h-3" />
              {rec.final_risk_level}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold tabular-nums bg-slate-100 text-slate-700 border-slate-200">
              Score {event.score}
            </span>
            <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium", mathOk ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200")} title={mathOk ? "Line items sum matches verified total" : "Line item sum does not match stated total"}>
              <Calculator className="w-3 h-3" />
              {mathOk ? "Math verified" : "Math mismatch"}
            </span>
            {event.override && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 border border-violet-200 text-[11px] font-semibold">
                <Ban className="w-3 h-3" /> FALSE-POSITIVE SUPPRESSED
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5 font-mono">
            {p.document_id} · {formatCurrency(cf.verified_amount, cf.currency)}
          </p>
          <p className="text-sm text-slate-700 mt-2 leading-relaxed">{rec.system_note}</p>

          {/* Cleansed metadata + legacy alert closure */}
          <div className="flex items-center gap-2 flex-wrap mt-2.5">
            <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border", cm.bank_account ? "bg-slate-50 text-slate-600 border-slate-200" : "bg-amber-50 text-amber-700 border-amber-200")} title={cm.bank_account ? "Verified bank account" : "No valid bank account on document — field set to null"}>
              <Building2 className="w-3 h-3" />
              Bank: {cm.bank_account || "null"}
            </span>
            {cm.phone_number && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border bg-slate-50 text-slate-600 border-slate-200" title="Phone number separated from bank-account field">
                <Phone className="w-3 h-3" /> {cm.phone_number}
              </span>
            )}
            <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border", rec.action === "FORCE_OVERRIDE" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : rec.action === "MONITOR" ? "bg-slate-50 text-slate-600 border-slate-200" : "bg-red-50 text-red-700 border-red-200")}>
              {rec.action === "FORCE_OVERRIDE" ? <ShieldCheck className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
              action: {rec.action}
            </span>
            {closed.map((a) => (
              <span key={a} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border bg-emerald-50 text-emerald-700 border-emerald-200" title="Legacy alert closed by correction payload">
                <X className="w-3 h-3" /> {a}
              </span>
            ))}
          </div>
        </div>
        <button onClick={copy} className="shrink-0 p-1.5 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600" title="Copy JSON payload">
          {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>

      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-4 py-2 border-t border-slate-100 text-xs text-slate-500 hover:bg-slate-50/60 transition-colors"
      >
        {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        {expanded ? "Hide" : "Show"} JSON webhook payload
      </button>

      {expanded && (
        <pre className="text-[11px] bg-slate-900 text-slate-100 px-4 py-3 overflow-x-auto font-mono leading-relaxed border-t border-slate-100">
{JSON.stringify(p, null, 2)}
        </pre>
      )}
    </div>
  );
}