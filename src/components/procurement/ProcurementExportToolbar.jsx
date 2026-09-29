import React, { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { exportProcurementFindings } from "@/lib/procurementFindingsExport";

export default function ProcurementExportToolbar({ transactions, batchId, loading }) {
  const [exporting, setExporting] = useState("");
  const [error, setError] = useState("");
  const exportFile = async (format) => {
    setExporting(format); setError("");
    try { await exportProcurementFindings(transactions, format, batchId); }
    catch (e) { setError(e.message || "Export failed."); }
    finally { setExporting(""); }
  };
  return <div className="flex flex-col gap-1">
    <div className="flex flex-wrap items-center gap-2" aria-label="Export procurement findings">
      <span className="text-xs font-medium text-slate-600">Export shown findings</span>
      {["xlsx", "csv", "pdf", "json"].map((format) => <button
        key={format} type="button" disabled={loading || !transactions.length || !!exporting}
        onClick={() => exportFile(format)} aria-label={`Export procurement findings as ${format.toUpperCase()}`}
        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >{exporting === format ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}{format.toUpperCase()}</button>)}
    </div>
    {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
  </div>;
}