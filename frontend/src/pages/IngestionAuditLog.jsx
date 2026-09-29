import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import BackToTop from "@/components/BackToTop";
import AuditFilters from "@/components/ingestion/AuditFilters";
import AuditExportToolbar from "@/components/ingestion/AuditExportToolbar";
import AuditRecordsTable from "@/components/ingestion/AuditRecordsTable";
import { filterAudit, loadAuditHistory } from "@/lib/ingestionAudit";
import { exportIngestionAudit } from "@/lib/ingestionAuditExport";

const empty = { search: "", risk: "", sector: "", from: "", to: "" };
export default function IngestionAuditLog() {
  const batchId = new URLSearchParams(window.location.search).get("batch") || "";
  const [records, setRecords] = useState([]);
  const [filters, setFilters] = useState(empty);
  const [scope, setScope] = useState("filtered");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState("");
  const load = useCallback(async () => {
    try { setRecords(await loadAuditHistory(base44)); setError(""); }
    catch (e) { setError(e.message || "Could not load ingestion history."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    load();
    const unsub = base44.entities.Transaction.subscribe(() => load());
    const unsubFailures = base44.entities.IngestionAuditFailure.subscribe(() => load());
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => { unsub(); unsubFailures(); window.removeEventListener("focus", onFocus); };
  }, [load]);
  const sectors = useMemo(() => [...new Set(records.map((r) => r.sector))].sort(), [records]);
  const filtered = useMemo(() => filterAudit(records.filter((r) => !batchId || r.batch_id === batchId), filters), [records, filters, batchId]);
  const handleExport = async (format) => {
    setExporting(format); setError("");
    try {
      const data = scope === "all" ? await loadAuditHistory(base44) : filtered;
      if (data.length === 0) throw new Error("There are no records to export in this selection.");
      exportIngestionAudit(data, format, scope);
    } catch (e) { setError(e.message || "Export failed."); }
    finally { setExporting(""); }
  };
  return <div className="min-h-screen">
    <header className="border-b border-slate-200 bg-white px-4 py-4 md:px-8"><h1 className="text-lg font-bold text-slate-900">Ingestion Audit Log</h1><p className="text-xs text-slate-500">{batchId ? "Results from the selected upload" : "All saved ingestion records, risk assessments and review decisions"}</p>{batchId && <Link className="text-xs font-medium text-blue-700 hover:underline" to="/ingestion-audit">View all uploads</Link>}</header>
    <div className="space-y-5 p-4 md:p-8">
      <AuditFilters filters={filters} onChange={setFilters} sectors={sectors} />
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <AuditExportToolbar count={filtered.length} scope={scope} onScopeChange={setScope} onExport={handleExport} exporting={exporting} />
        <AuditRecordsTable records={filtered} loading={loading} />
      </div>
    </div><BackToTop />
  </div>;
}