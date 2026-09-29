import React from "react";
import { Download, Loader2 } from "lucide-react";

export default function AuditExportToolbar({ scope, onScopeChange, onExport, exporting, count }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
    <p className="text-sm text-slate-600">{count} record{count === 1 ? "" : "s"} in view</p>
    <div className="flex flex-wrap items-center gap-2">
      <label className="text-xs text-slate-500">Export scope <select aria-label="Export scope" value={scope} onChange={(e) => onScopeChange(e.target.value)} className="ml-1 rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-700"><option value="filtered">Filtered results</option><option value="all">Entire history</option></select></label>
      {["xlsx", "csv", "pdf", "json"].map((format) => <button key={format} type="button" disabled={exporting} onClick={() => onExport(format)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50" aria-label={`Export to ${format.toUpperCase()}`}>{exporting === format ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} {format.toUpperCase()}</button>)}
    </div>
  </div>;
}