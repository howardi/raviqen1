import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import {
  Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, XCircle, Loader2, FileX, Trash2, CheckSquare, Square,
} from "lucide-react";
import POSConnectors from "@/components/ingestion/POSConnectors";
import SearchFilterBar from "@/components/SearchFilterBar";
import BackToTop from "@/components/BackToTop";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";
import { logActivity } from "@/lib/activityLogger";
import { stampTenant } from "@/lib/tenantScope";
import { processIngestedFile } from "@/lib/autonomousEngine";
import { extractRecordsFromFile } from "@/lib/ingestionScreening";
import { inspectProcurementRow } from "@/lib/procurementEvidence";
import { sendFlaggedTransactionAlert } from "@/lib/companyNotifications";
import IngestionScannerPanel from "@/components/ingestion/IngestionScannerPanel";

export default function DataIngestion() {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [dataSource, setDataSource] = useState("Procurement");
  const [selectedBatchIds, setSelectedBatchIds] = useState([]);
  const [bulkActing, setBulkActing] = useState(false);
  const [scanStep, setScanStep] = useState(-1);
  const [scanResult, setScanResult] = useState(null);
  const [progress, setProgress] = useState(null);
  const [checkingBatch, setCheckingBatch] = useState(null);
  const [sourceCheck, setSourceCheck] = useState(null);
  const scanTimerRef = useRef(null);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dataSourceFilter, setDataSourceFilter] = useState("");
  const fileInputRef = useRef(null);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    loadBatches();
  }, []);

  const loadBatches = async () => {
    try {
      const data = await base44.entities.IngestionBatch.list("-created_date", 20);
      setBatches(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const toggleBatch = (id) => {
    setSelectedBatchIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleBulkDeleteBatches = async () => {
    if (selectedBatchIds.length === 0) return;
    setBulkActing(true);
    try {
      await base44.entities.IngestionBatch.deleteMany({ id: { $in: selectedBatchIds } });
      setSelectedBatchIds([]);
      await loadBatches();
    } catch (e) {
      console.error(e);
    } finally {
      setBulkActing(false);
    }
  };

  const filteredBatches = batches.filter((b) => {
    if (search) {
      const q = search.toLowerCase();
      if (!`${b.filename || ""} ${b.data_source || ""} ${b.uploaded_by || ""}`.toLowerCase().includes(q)) return false;
    }
    if (statusFilter && b.status !== statusFilter) return false;
    if (dataSourceFilter && b.data_source !== dataSourceFilter) return false;
    if (dateFrom || dateTo) {
      const d = b.created_date ? new Date(b.created_date) : null;
      if (!d) return false;
      if (dateFrom && d < new Date(dateFrom)) return false;
      if (dateTo && d > new Date(dateTo + "T23:59:59")) return false;
    }
    return true;
  });

  const handleFile = async (file, { storedUrl = null, sourceType = dataSource } = {}) => {
    if (!file) return;
    setUploading(true);
    setScanResult(null);
    setProgress(null);
    setScanStep(0);
    let batchId = null;
    // Animate pipeline steps during scan
    let step = 0;
    scanTimerRef.current = setInterval(() => {
      step = Math.min(step + 1, 5);
      setScanStep(step);
    }, 1400);
    try {
      // 1. Upload file
      const file_url = storedUrl || (await base44.integrations.Core.UploadFile({ file })).file_url;
      // 2. Create batch record
      const batch = await base44.entities.IngestionBatch.create(stampTenant({
        filename: file.name,
        file_url,
        status: "validating",
        data_source: sourceType,
        total_records: 0,
        valid_records: 0,
        quarantined_records: 0,
        flagged_records: 0,
      }, user));
      batchId = batch.id;
      // 3. Run autonomous engine (extracts, resolves entities, compares history, alerts, builds cases)
      const scanResult = await processIngestedFile(file, file_url, "data_ingestion", batch.id, user, (done, total) => setProgress({ done, total }));
      // Guard: nothing extractable — fail clearly instead of silently completing with 0s
      if (!scanResult?.summary || (scanResult.summary.total === 0 && !scanResult.summary.operationalAlerts)) {
        if (scanTimerRef.current) clearInterval(scanTimerRef.current);
        setScanStep(-1);
        await base44.entities.IngestionBatch.update(batch.id, {
          status: "failed",
          validation_errors: ["No transaction records could be extracted. Ensure the file contains transaction_id, vendor, and amount fields."],
        });
        toast({ title: "No records found", description: "We couldn't extract any transaction records from this file.", variant: "destructive" });
        await loadBatches();
        return;
      }
      clearInterval(scanTimerRef.current);
      setScanStep(5);
      setScanResult(scanResult.summary);
      const allInvalid = scanResult.summary.invalid === scanResult.summary.total;
      // 4. Update batch with engine results
      await base44.entities.IngestionBatch.update(batch.id, {
        status: allInvalid ? "failed" : "completed",
        total_records: scanResult.summary.total,
        valid_records: scanResult.summary.clean,
        quarantined_records: scanResult.summary.quarantined,
        flagged_records: scanResult.summary.flagged,
        validation_errors: allInvalid ? ["Every row failed validation or processing. Check the audit log; no risk score was assigned to invalid rows."] : scanResult.summary.quarantined > 0 ? [`${scanResult.summary.quarantined} records require review in the audit log.`] : [],
      });
      if (allInvalid) toast({ title: scanResult.summary.operationalAlerts ? "Operational findings saved" : "No valid records processed", description: scanResult.summary.operationalAlerts ? `${scanResult.summary.operationalAlerts} fraud-related alert(s) saved; transaction rows still require review.` : "All rows require review. Check the batch error below and the ingestion audit log.", variant: scanResult.summary.operationalAlerts ? "default" : "destructive" });
      if (scanResult.summary.operationalError) toast({ title: "Operational scan incomplete", description: scanResult.summary.operationalError, variant: "destructive" });
      // 5. Log activity
      await logActivity(user, "data_ingestion", `Uploaded ${file.name}: ${scanResult.summary.clean} valid, ${scanResult.summary.flagged} flagged, ${scanResult.summary.alerts} alerts, ${scanResult.summary.casesOpened} cases opened`, "IngestionBatch", batch.id);
      // 6. Send high-risk notification to admins and company notification email
      if (scanResult.summary.flagged > 0) {
        // Send to company's dedicated notification email
        try { await sendFlaggedTransactionAlert(file.name, scanResult.summary); } catch (e) {}
        try {
          const allUsers = await base44.entities.User.list("-created_date", 50);
          const admins = allUsers.filter((u) => {
            const r = u.raviqen_role || u.role;
            return r === "super_admin" || r === "org_admin" || r === "admin";
          });
          for (const admin of admins) {
            try {
              await base44.integrations.Core.SendEmail({
                to: admin.email,
                subject: `RAVIQEN Alert: ${scanResult.summary.flagged} flagged transaction(s) from autonomous scan`,
                body: `Hello ${admin.full_name || admin.email},\n\nThe Autonomous Scanning Engine processed "${file.name}" and flagged ${scanResult.summary.flagged} transaction(s).\n\nSummary:\n- Total records: ${scanResult.summary.total}\n- Clean: ${scanResult.summary.clean}\n- Flagged: ${scanResult.summary.flagged}\n- Quarantined: ${scanResult.summary.quarantined}\n- Alerts generated: ${scanResult.summary.alerts}\n- Cases opened: ${scanResult.summary.casesOpened}\n- New entities: ${scanResult.summary.newEntities}\n\nReview the flagged transactions in the RAVIQEN dashboard.\n\nRAVIQEN Risk & Compliance Intelligence`,
              });
            } catch (e) {}
          }
        } catch (e) {}
      }

      await loadBatches();
    } catch (e) {
      console.error(e);
      if (scanTimerRef.current) clearInterval(scanTimerRef.current);
      setScanStep(-1);
      // Mark the batch as failed so it doesn't spin forever in "validating"
      if (batchId) {
        try {
          await base44.entities.IngestionBatch.update(batchId, {
            status: "failed",
            validation_errors: [e?.message || "Ingestion failed during processing"],
          });
        } catch (_) {}
      }
      toast({ title: "Ingestion failed", description: e?.message || "We couldn't process this file. Please check the format and try again.", variant: "destructive" });
      await loadBatches();
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const checkSource = async (batch) => {
    setCheckingBatch(batch.id);
    setSourceCheck(null);
    try {
      const rows = await extractRecordsFromFile(batch.file_url);
      const ready = rows.filter((r) => !r.missing.length);
      const sources = ready.map((r) => r.record);
      const evidenceCount = sources.reduce((count, record) => count + inspectProcurementRow(record, sources).length, 0);
      setSourceCheck({ batchId: batch.id, total: rows.length, ready: ready.length, evidenceCount,
        example: ready.slice(0, 2).map((r) => `${r.record.transaction_id}: ${r.record.vendor}, ${r.record.currency || "currency unknown"} ${r.record.amount}`),
        missing: rows.find((r) => r.missing.length)?.missing.join(", ") || "" });
    } catch (e) {
      toast({ title: "Could not read saved source", description: e.message, variant: "destructive" });
    } finally { setCheckingBatch(null); }
  };

  const reprocessBatch = async (batch) => {
    try {
      const response = await fetch(batch.file_url);
      if (!response.ok) throw new Error("Saved source file could not be loaded");
      const file = new File([await response.blob()], batch.filename);
      await handleFile(file, { storedUrl: batch.file_url, sourceType: batch.data_source });
    } catch (e) {
      toast({ title: "Could not reprocess saved file", description: e.message, variant: "destructive" });
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const needsSourceReview = (batch) => batch.status === "failed" || (batch.total_records > 0 && batch.quarantined_records === batch.total_records && batch.validation_errors?.some((message) => message.includes("quarantined by autonomous engine")));

  const statusConfig = {
    completed: { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
    validating: { icon: Loader2, color: "text-blue-600", bg: "bg-blue-50", spin: true },
    uploaded: { icon: Loader2, color: "text-blue-600", bg: "bg-blue-50", spin: true },
    failed: { icon: XCircle, color: "text-red-600", bg: "bg-red-50" },
  };

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-slate-200 px-4 md:px-8 py-4 sticky top-0 z-10">
        <h1 className="text-lg font-bold text-[#231F20]">Data Ingestion Portal</h1>
        <p className="text-xs text-slate-500">Upload transaction data for validation, normalization, and risk scoring</p>
        <Link to="/ingestion-audit" className="mt-2 inline-block text-xs font-semibold text-blue-700 hover:underline">View Ingestion Audit Log →</Link>
      </header>

      <div className="p-4 md:p-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload zone */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-[#231F20] mb-4">Upload New Dataset</h3>
            <div className="mb-4">
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">Data Source Type</label>
              <select
                value={dataSource}
                onChange={(e) => setDataSource(e.target.value)}
                className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 focus:border-slate-400 focus:ring-1 focus:ring-slate-300 outline-none bg-white"
              >
                {["Procurement", "Payroll", "Vendor Payments", "Expense Reports", "Bank Transfers", "POS Sales Transactions", "Invoices", "Goods Receiving / Inventory", "Food & Beverage Data", "Expense Data", "Hotel / Hospitality Data", "Housekeeping / Operations", "Supplier / Vendor Data", "Accounts Payable", "Accounts Receivable", "General Ledger / Accounting", "Cash Management", "Discounts & Promotions", "Asset & Maintenance Data", "Contract Data", "Employee Activity / Access Logs", "Management Reports", "Budget & Forecast Data"].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => !uploading && fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
                dragOver ? "border-slate-900 bg-slate-50" : "border-slate-200 hover:border-slate-400 hover:bg-slate-50/50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls,.tsv,.json,.xml,.txt,.parquet,.pdf,.doc,.docx,.jpg,.jpeg,.png,.gif"
                className="hidden"
                onChange={(e) => handleFile(e.target.files[0])}
              />
              {uploading ? (
                <>
                  <Loader2 className="w-10 h-10 mx-auto text-slate-400 mb-3 animate-spin" />
                  <p className="text-sm font-medium text-slate-700">Processing dataset...</p>
                  <p className="text-xs text-slate-400 mt-1">Validating, normalizing, and scoring risk</p>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 mx-auto rounded-xl bg-slate-100 flex items-center justify-center mb-3">
                    <Upload className="w-6 h-6 text-slate-500" />
                  </div>
                  <p className="text-sm font-medium text-slate-700">Drop your file here</p>
                  <p className="text-xs text-slate-400 mt-1">CSV, Excel, JSON, TSV, XML, TXT, Parquet, PDF · Max 25MB</p>
                </>
              )}
            </div>

            <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-blue-50/60 border border-blue-100">
              <FileSpreadsheet className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700">
                Required columns: <span className="font-mono">transaction_id, vendor, amount</span>. Optional: currency, transaction_date, category, location.
              </p>
            </div>
          </div>

          <IngestionScannerPanel
            scanning={uploading}
            scanStep={scanStep}
            scanResult={scanResult}
            progress={progress}
          />

          <SearchFilterBar
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search by filename, data source..."
            dateFrom={dateFrom}
            onDateFromChange={setDateFrom}
            dateTo={dateTo}
            onDateToChange={setDateTo}
            selects={[
              { key: "status", label: "All Statuses", value: statusFilter, onChange: setStatusFilter, options: [
                { value: "completed", label: "Completed" },
                { value: "validating", label: "Validating" },
                { value: "uploaded", label: "Uploaded" },
                { value: "failed", label: "Failed" },
              ]},
              { key: "source", label: "All Data Sources", value: dataSourceFilter, onChange: setDataSourceFilter, options: [
                { value: "Procurement", label: "Procurement" },
                { value: "Payroll", label: "Payroll" },
                { value: "Vendor Payments", label: "Vendor Payments" },
                { value: "Expense Reports", label: "Expense Reports" },
                { value: "Bank Transfers", label: "Bank Transfers" },
                { value: "POS Sales Transactions", label: "POS Sales" },
                { value: "Invoices", label: "Invoices" },
              ]},
            ]}
            onClear={() => { setSearch(""); setDateFrom(""); setDateTo(""); setStatusFilter(""); setDataSourceFilter(""); }}
          />

          {/* Batch history */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[#231F20]">Ingestion History</h3>
              {selectedBatchIds.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">{selectedBatchIds.length} selected</span>
                  <button
                    onClick={handleBulkDeleteBatches}
                    disabled={bulkActing}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-700 border border-red-200 text-xs font-medium hover:bg-red-100 disabled:opacity-50 transition-colors"
                  >
                    {bulkActing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    Delete Selected
                  </button>
                  <button
                    onClick={() => setSelectedBatchIds([])}
                    className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-lg bg-slate-100 animate-pulse" />)}
              </div>
            ) : filteredBatches.length === 0 ? (
              <div className="text-center py-12">
                <FileX className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="text-sm text-slate-400">No datasets ingested yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredBatches.map((batch) => {
                  const sc = needsSourceReview(batch) ? statusConfig.failed : statusConfig[batch.status] || statusConfig.completed;
                   const alreadyReprocessed = batches.some((other) => other.id !== batch.id && other.file_url === batch.file_url && other.status === "completed" && (other.valid_records > 0 || other.flagged_records > 0));
                  const SIcon = sc.icon;
                  return (
                    <div key={batch.id} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:bg-slate-50/60 transition-colors">
                      <button onClick={() => toggleBatch(batch.id)} className="shrink-0">
                        {selectedBatchIds.includes(batch.id) ? <CheckSquare className="w-4 h-4 text-slate-900" /> : <Square className="w-4 h-4 text-slate-300" />}
                      </button>
                      <div className={`w-9 h-9 rounded-lg ${sc.bg} flex items-center justify-center shrink-0`}>
                        <SIcon className={`w-4 h-4 ${sc.color} ${sc.spin ? "animate-spin" : ""}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[#231F20] truncate">{batch.filename}</p>
                        <p className="text-xs text-slate-400">
                          {batch.data_source} · {new Date(batch.created_date).toLocaleDateString()}
                        </p>
                        {batch.validation_errors?.length > 0 && <p className="mt-1 text-xs text-red-700">{batch.validation_errors[0]}</p>}
                        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                          {batch.total_records > 0 && <Link className="font-medium text-blue-700 hover:underline" to={`/ingestion-audit?batch=${batch.id}`}>View audit results</Link>}
                          {(batch.valid_records > 0 || batch.flagged_records > 0) && batch.data_source === "Procurement" && <Link className="font-medium text-blue-700 hover:underline" to={`/procurement-variance?batch=${batch.id}`}>View procurement findings</Link>}
                          {batch.file_url && needsSourceReview(batch) && <>
                            <button type="button" disabled={uploading || !!checkingBatch} onClick={() => checkSource(batch)} className="font-medium text-blue-700 hover:underline disabled:opacity-50">{checkingBatch === batch.id ? "Checking source…" : "Check source mapping"}</button>
                            {!alreadyReprocessed && <button type="button" disabled={uploading || !!checkingBatch} onClick={() => reprocessBatch(batch)} className="font-medium text-blue-700 hover:underline disabled:opacity-50">Reprocess saved file</button>}
                          </>}
                        </div>
                        {alreadyReprocessed && needsSourceReview(batch) && <p className="mt-1 text-xs text-slate-500">A newer processing run is available above.</p>}
                        {sourceCheck?.batchId === batch.id && <p role="status" className="mt-2 text-xs text-slate-700">Source check: {sourceCheck.ready} of {sourceCheck.total} rows have required fields; {sourceCheck.evidenceCount} source-backed procurement findings need review.{sourceCheck.missing && ` Missing: ${sourceCheck.missing}.`} {sourceCheck.example.join("; ")}</p>}
                      </div>
                      <div className="flex items-center gap-4 text-xs shrink-0">
                        <div className="text-center">
                          <p className="font-semibold text-slate-700 tabular-nums">{batch.total_records}</p>
                          <p className="text-slate-400 text-[10px]">Total</p>
                        </div>
                        <div className="text-center">
                          <p className="font-semibold text-emerald-600 tabular-nums">{batch.valid_records}</p>
                          <p className="text-slate-400 text-[10px]">Valid</p>
                        </div>
                        <div className="text-center">
                          <p className="font-semibold text-amber-600 tabular-nums">{batch.flagged_records}</p>
                          <p className="text-slate-400 text-[10px]">Flagged</p>
                        </div>
                        <div className="text-center">
                          <p className="font-semibold text-red-600 tabular-nums">{batch.quarantined_records}</p>
                          <p className="text-slate-400 text-[10px]">Quarantined</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Side: quarantine info */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-semibold text-[#231F20]">Quarantine Rules</h3>
            </div>
            <div className="space-y-2.5 text-xs text-slate-600">
              <p>Records missing required fields (<span className="font-mono">transaction_id, vendor, amount</span>) are automatically quarantined.</p>
              <p>Transactions exceeding $50,000 are flagged for review and assigned a risk score.</p>
              <p>Excel serial dates are normalized to ISO dates; missing or invalid source values are not invented.</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-[#231F20] mb-4">Supported Formats</h3>
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Tabular &amp; Structured</p>
                <div className="flex flex-wrap gap-1.5">
                  {["CSV", "XLSX", "XLS", "JSON", "TSV", "XML"].map((f) => (
                    <span key={f} className="px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 text-[11px] font-mono font-semibold border border-emerald-100">{f}</span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Flat &amp; Raw Text</p>
                <div className="flex flex-wrap gap-1.5">
                  {["TXT"].map((f) => (
                    <span key={f} className="px-2 py-1 rounded-md bg-slate-100 text-slate-700 text-[11px] font-mono font-semibold border border-slate-200">{f}</span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Advanced / Big Data</p>
                <div className="flex flex-wrap gap-1.5">
                  {["Parquet"].map((f) => (
                    <span key={f} className="px-2 py-1 rounded-md bg-violet-50 text-violet-700 text-[11px] font-mono font-semibold border border-violet-100">{f}</span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Documents &amp; Statements</p>
                <div className="flex flex-wrap gap-1.5">
                  {["PDF", "DOC", "DOCX", "JPG", "PNG"].map((f) => (
                    <span key={f} className="px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-[11px] font-mono font-semibold border border-blue-100">{f}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* POS System Connectors — cloud sync or manual upload */}
      <div className="px-4 md:px-8 pb-8">
        <POSConnectors />
      </div>

      <BackToTop />
    </div>
  );
}