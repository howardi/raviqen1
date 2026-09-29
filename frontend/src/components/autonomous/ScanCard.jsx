import React, { useState } from "react";
import { ChevronDown, ChevronUp, AlertTriangle, Building2, FileSearch, CheckCircle2, Loader2, XCircle } from "lucide-react";
import RiskBadge from "@/components/RiskBadge";

const sourceLabels = {
  data_ingestion: "Data Ingestion",
  manual_upload: "Manual Upload",
  api_connector: "API Connector",
  file_drop: "File Drop",
  ocr_scan: "OCR Scan",
};

const statusConfig = {
  scanning: { icon: Loader2, color: "text-blue-600", bg: "bg-blue-50", spin: true },
  completed: { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
  failed: { icon: XCircle, color: "text-red-600", bg: "bg-red-50" },
};

export default function ScanCard({ scan }) {
  const [expanded, setExpanded] = useState(false);
  const sc = statusConfig[scan.status] || statusConfig.completed;
  const SIcon = sc.icon;

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 hover:bg-slate-50/60 transition-colors text-left"
      >
        <div className={`w-10 h-10 rounded-lg ${sc.bg} flex items-center justify-center shrink-0`}>
          <SIcon className={`w-5 h-5 ${sc.color} ${sc.spin ? "animate-spin" : ""}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-[#231F20] truncate">{scan.filename || scan.scan_id}</span>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[10px] font-medium text-slate-600">
              {sourceLabels[scan.source] || scan.source}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {new Date(scan.created_date).toLocaleString()} · {(scan.duration_ms / 1000).toFixed(1)}s
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0 text-xs">
          <div className="text-center"><p className="font-bold text-slate-700 tabular-nums">{scan.total_records}</p><p className="text-slate-400 text-[10px]">Total</p></div>
          <div className="text-center"><p className="font-bold text-emerald-600 tabular-nums">{scan.clean_records}</p><p className="text-slate-400 text-[10px]">Clean</p></div>
          <div className="text-center"><p className="font-bold text-amber-600 tabular-nums">{scan.flagged_records}</p><p className="text-slate-400 text-[10px]">Flagged</p></div>
          <div className="text-center"><p className="font-bold text-red-600 tabular-nums">{scan.quarantined_records}</p><p className="text-slate-400 text-[10px]">Quarantined</p></div>
          {scan.alerts_generated > 0 && <div className="text-center"><p className="font-bold text-orange-600 tabular-nums">{scan.alerts_generated}</p><p className="text-slate-400 text-[10px]">Alerts</p></div>}
          {scan.cases_opened + scan.cases_updated > 0 && <div className="text-center"><p className="font-bold text-violet-600 tabular-nums">{scan.cases_opened + scan.cases_updated}</p><p className="text-slate-400 text-[10px]">Cases</p></div>}
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {expanded && scan.scan_results?.length > 0 && (
        <div className="border-t border-slate-100 bg-slate-50/40 p-4 space-y-2">
          {scan.scan_results.map((r, idx) => (
            <div key={idx} className="bg-white rounded-lg border border-slate-100 p-3">
              <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${r.status === "clean" ? "bg-emerald-500" : r.status === "flagged" ? "bg-amber-500" : "bg-red-500"}`} />
                  <span className="text-xs font-mono text-slate-600 truncate">{r.transaction_id}</span>
                  <span className="text-xs text-slate-400 truncate">{r.vendor}</span>
                  {r.is_new_entity && <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 text-[10px] font-medium">NEW ENTITY</span>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-bold text-slate-700">{r.amount?.toLocaleString()}</span>
                  {r.risk_score == null ? <span className="text-xs text-slate-500">Not scored</span> : <><RiskBadge level={r.risk_level} size="sm" /><span className="text-xs font-bold tabular-nums text-slate-600">{r.risk_score}/100</span></>}
                </div>
              </div>
              {r.discrepancies?.length > 0 && (
                <div className="mt-2 space-y-1">
                  {r.discrepancies.map((d, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-xs">
                      <AlertTriangle className={`w-3 h-3 shrink-0 mt-0.5 ${d.severity === "critical" ? "text-red-500" : d.severity === "high" ? "text-orange-500" : "text-amber-500"}`} />
                      <span className="text-slate-600"><span className="font-medium text-slate-700">{d.title}:</span> {d.detail}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-400">
                {r.entity_name && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" /> {r.entity_name}</span>}
                {r.alert_id && <span className="flex items-center gap-1 text-orange-500"><AlertTriangle className="w-3 h-3" /> Alert generated</span>}
                {r.case_id && <span className="flex items-center gap-1 text-violet-500"><FileSearch className="w-3 h-3" /> {r.has_briefing ? "Case + AI briefing" : "Case opened"}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}