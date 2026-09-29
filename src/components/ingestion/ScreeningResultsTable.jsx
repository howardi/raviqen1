import React from "react";
import { cn } from "@/lib/utils";
import { CheckCircle2, AlertTriangle, Ban, ChevronRight, ShieldCheck, FileCheck2 } from "lucide-react";
import { formatCurrency } from "@/lib/currencyUtils";

const STATUS_CONFIG = {
  valid: { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50", label: "Valid" },
  flagged: { icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50", label: "Flagged" },
  quarantined: { icon: Ban, color: "text-red-600", bg: "bg-red-50", label: "Quarantined" },
};

const CLEARANCE_BADGE = {
  "GENUINE B2B OUTLIER - CLEARED BY LOGIC": { icon: ShieldCheck, classes: "bg-emerald-100 text-emerald-700", short: "Cleared by Logic" },
  "Verified Business Operations - Cleared by Logic": { icon: ShieldCheck, classes: "bg-emerald-100 text-emerald-700", short: "Verified Ops" },
  "APPROVED_BY_CONTRACT": { icon: FileCheck2, classes: "bg-blue-100 text-blue-700", short: "Approved by Contract" },
  "VERIFIED ENTERPRISE - LOW RISK": { icon: ShieldCheck, classes: "bg-emerald-100 text-emerald-700", short: "Verified Enterprise" },
};


export default function ScreeningResultsTable({ results, onSelectRecord }) {
  if (!results || results.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#231F20]">Screening Results</h3>
        <span className="text-xs text-slate-400">{results.length} record{results.length !== 1 ? "s" : ""} processed</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50/60 border-b border-slate-100 text-left">
              <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Txn ID</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Vendor</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Counterparty</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Amount</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide text-center">Risk Score</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden xl:table-cell">Clearance</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Next Step</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {results.map((r, idx) => {
              const sc = STATUS_CONFIG[r.verification_status] || STATUS_CONFIG.valid;
              const SIcon = sc.icon;
              const rec = r.normalized || {};
              return (
                <tr
                  key={idx}
                  onClick={() => onSelectRecord?.(r)}
                  className="hover:bg-slate-50/60 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">{rec.transaction_id || "—"}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{rec.vendor || "—"}</td>
                  <td className="px-4 py-3 text-slate-600 hidden md:table-cell">{rec.counterparty || "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">{formatCurrency(rec.amount, rec.currency)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn("inline-flex items-center justify-center w-9 h-9 rounded-full text-xs font-bold tabular-nums",
                      r.risk_level === "not_scored" ? "bg-slate-100 text-slate-600" :
                      r.risk_level === "critical" ? "bg-red-100 text-red-700" :
                      r.risk_level === "high" ? "bg-orange-100 text-orange-700" :
                      r.risk_level === "medium" ? "bg-amber-100 text-amber-700" :
                      "bg-emerald-100 text-emerald-700"
                    )}>
                      {r.risk_score?.total ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium", sc.bg, sc.color)}>
                      <SIcon className="w-3 h-3" />
                      {sc.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden xl:table-cell">
                    {(() => {
                      const label = r.contextual?.clearanceLabel;
                      if (!label) return <span className="text-xs text-slate-300">—</span>;
                      const badge = CLEARANCE_BADGE[label] || { icon: ShieldCheck, classes: "bg-slate-100 text-slate-600", short: label };
                      const BIcon = badge.icon;
                      return (
                        <span className={cn("inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium", badge.classes)}>
                          <BIcon className="w-3 h-3" />
                          {badge.short}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 hidden lg:table-cell max-w-[200px] truncate">{r.next_steps?.[0] || "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}