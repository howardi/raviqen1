import React, { useState } from "react";
import { ShieldCheck, ShieldAlert, RefreshCw, ChevronDown, ChevronUp, CheckCircle2, AlertTriangle } from "lucide-react";

export default function DataIntegrityPanel({ validation, isValidating, onRevalidate }) {
  const [expanded, setExpanded] = useState(false);

  const isVerified = validation?.status === "verified";
  const hasDiscrepancy = validation?.status === "discrepancy";

  const verifiedAt = validation?.verifiedAt
    ? new Date(validation.verifiedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : null;

  return (
    <div
      className={`rounded-xl border p-4 transition-colors ${
        hasDiscrepancy
          ? "border-amber-300 bg-amber-50/50"
          : "border-emerald-200 bg-emerald-50/30"
      }`}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              hasDiscrepancy ? "bg-amber-100" : "bg-emerald-100"
            }`}
          >
            {hasDiscrepancy ? (
              <ShieldAlert className="w-4 h-4 text-amber-600" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#231F20]">Data Integrity Verification</h3>
            <p className="text-xs text-slate-500">
              {isValidating
                ? "Cross-checking metrics against source records…"
                : isVerified
                ? `All metrics verified against source records${verifiedAt ? ` · ${verifiedAt}` : ""}`
                : `${validation?.issues?.length || 0} discrepancy${(validation?.issues?.length || 0) === 1 ? "" : "ies"} detected${verifiedAt ? ` · ${verifiedAt}` : ""}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
              hasDiscrepancy
                ? "bg-amber-100 text-amber-800 border-amber-200"
                : "bg-emerald-100 text-emerald-800 border-emerald-200"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${hasDiscrepancy ? "bg-amber-500" : "bg-emerald-500 animate-pulse"}`} />
            {hasDiscrepancy ? "Discrepancy" : "Verified"}
          </span>
          <button
            onClick={onRevalidate}
            disabled={isValidating}
            title="Re-verify data integrity"
            className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isValidating ? "animate-spin" : ""}`} />
          </button>
          {validation?.statsValidation?.checks?.length > 0 && (
            <button
              onClick={() => setExpanded((p) => !p)}
              className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
              title={expanded ? "Collapse details" : "Expand details"}
            >
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>

      {expanded && validation?.statsValidation && (
        <div className="mt-4 pt-4 border-t border-slate-200/60">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
            {validation.statsValidation.checks.map((check) => (
              <div
                key={check.key}
                className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-xs ${
                  check.pass
                    ? "border-emerald-100 bg-white"
                    : "border-amber-200 bg-amber-50/60"
                }`}
              >
                {check.pass ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="font-medium text-slate-700 truncate">{check.label}</p>
                  <p className={`font-mono ${check.pass ? "text-slate-400" : "text-amber-700"}`}>
                    {check.pass ? `${check.verified}` : `${check.displayed} → ${check.verified}`}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {validation.sourceCounts && (
            <p className="mt-3 text-[11px] text-slate-400">
              Source records: {validation.sourceCounts.rawTransactions} transactions · {validation.sourceCounts.rawAlerts} alerts · {validation.sourceCounts.filteredTransactions} filtered tx · {validation.sourceCounts.filteredAlerts} filtered alerts
            </p>
          )}

          {hasDiscrepancy && validation.issues?.length > 0 && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
              <p className="text-xs font-semibold text-amber-800 mb-1.5">Discrepancy Details</p>
              <ul className="space-y-1">
                {validation.issues.map((issue, i) => (
                  <li key={i} className="text-xs text-amber-700 font-mono">{issue}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}