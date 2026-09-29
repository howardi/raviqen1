import React, { useState, useRef } from "react";
import { useAuth } from "@/lib/AuthContext";
import { logActivity } from "@/lib/activityLogger";
import { base44 } from "@/api/base44Client";
import { runMasterRiskEngine, extractMasterRecords } from "@/lib/masterRiskEngine";
import { persistFraudAlerts } from "@/lib/hospitalityFraudEngine";
import MasterRiskEventCard from "@/components/master/MasterRiskEventCard";
import BackToTop from "@/components/BackToTop";
import { Workflow, Upload, Loader2, FileX, ShieldX, ShieldAlert, ShieldCheck, Download } from "lucide-react";
import { cn } from "@/lib/utils";

export default function MasterRiskEngine() {
  const { user } = useAuth();
  const fileInput = useRef(null);
  const [processing, setProcessing] = useState(false);
  const [events, setEvents] = useState([]);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("ALL");

  const handleFile = async (file) => {
    if (!file) return;
    setProcessing(true);
    setError(null);
    setEvents([]);
    try {
      let fileUrl = null;
      const ext = (file.name || "").toLowerCase().split(".").pop() || "";
      if (!["csv", "tsv", "txt"].includes(ext)) {
        const up = await base44.integrations.Core.UploadPrivateFile({ file });
        fileUrl = (await base44.integrations.Core.CreateFileSignedUrl({ file_uri: up.file_uri })).signed_url;
      }
      const records = await extractMasterRecords(fileUrl, file);
      if (!records || records.length === 0) {
        setError("No records could be extracted from the uploaded file. Ensure the file contains invoice, procurement, PMS, POS, or HR/Expense data.");
        setProcessing(false);
        return;
      }
      const { events: evts } = await runMasterRiskEngine(records);
      await persistFraudAlerts(evts.filter((event) => event.alert).map((event) => event.alert), user, file.name);
      setEvents(evts);
      await logActivity(user, "master_risk_scan", `Master engine scanned ${file.name}: ${records.length} records → ${evts.length} payload(s)`, null, null);
    } catch (e) {
      console.error(e);
      setError(e.message || "Master scan failed. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  const action = (e) => e.action;
  const score = (e) => e.score;
  const status = (e) => (action(e) === "ESCALATE" ? "INVESTIGATION_REQUIRED" : "STABLE");
  const stats = {
    total: events.length,
    stable: events.filter((e) => status(e) === "STABLE").length,
    investigation: events.filter((e) => status(e) === "INVESTIGATION_REQUIRED").length,
    critical: events.filter((e) => score(e) >= 75).length,
    high: events.filter((e) => score(e) >= 55 && score(e) < 75).length,
    cleared: events.filter((e) => action(e) === "FORCE_OVERRIDE").length,
  };

  const filtered = filter === "ALL" ? events : events.filter((e) => status(e) === filter);

  const downloadAll = () => {
    const blob = new Blob([JSON.stringify(events.map((e) => e.payload), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "master_risk_payloads.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-slate-200 px-4 md:px-8 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-lg font-bold text-[#231F20] flex items-center gap-2">
            <Workflow className="w-5 h-5 text-slate-700" />
            Master Enterprise Risk, Fraud Intelligence & State Management Engine
          </h1>
          <div className="flex items-center gap-2">
            {events.length > 0 && (
              <button onClick={downloadAll} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors">
                <Download className="w-4 h-4" /> Export Payloads
              </button>
            )}
            <button onClick={() => fileInput.current?.click()} disabled={processing} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-sm">
              <Upload className="w-4 h-4" /> Ingest Data
            </button>
            <input ref={fileInput} type="file" accept=".csv,.tsv,.txt,.xlsx,.xls,.pdf,.docx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
          </div>
        </div>
      </header>

      <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
        {events.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <Stat label="Events" value={stats.total} icon={Workflow} tone="bg-slate-100 text-slate-700" />
            <Stat label="Stable" value={stats.stable} icon={ShieldCheck} tone="bg-emerald-50 text-emerald-700" />
            <Stat label="Investigation" value={stats.investigation} icon={ShieldAlert} tone="bg-red-50 text-red-700" />
            <Stat label="Critical" value={stats.critical} icon={ShieldX} tone="bg-red-50 text-red-700" />
            <Stat label="High" value={stats.high} icon={ShieldAlert} tone="bg-orange-50 text-orange-700" />
            <Stat label="Cleared" value={stats.cleared} icon={ShieldCheck} tone="bg-emerald-50 text-emerald-700" />
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2.5 p-4 rounded-xl bg-red-50 border border-red-200">
            <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {processing && (
          <div className="flex flex-col items-center gap-3 py-10">
            <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
            <p className="text-xs text-slate-400">Normalizing currencies, applying contextual baselines, suppressing false positives…</p>
          </div>
        )}

        {events.length > 0 && (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { key: "ALL", label: "All" },
                { key: "STABLE", label: "Stable" },
                { key: "INVESTIGATION_REQUIRED", label: "Investigation Required" },
              ].map((f) => {
                const count = f.key === "ALL" ? events.length : events.filter((e) => status(e) === f.key).length;
                return (
                  <button key={f.key} onClick={() => setFilter(f.key)} className={cn("px-3 py-1.5 rounded-full text-xs font-medium border transition-colors", filter === f.key ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50")}>
                    {f.label} <span className="ml-1.5 text-[10px] opacity-70">{count}</span>
                  </button>
                );
              })}
            </div>
            <div className="space-y-2.5">
              {filtered.map((e, i) => (
                <MasterRiskEventCard key={`${e.payload.document_id}-${i}`} event={e} />
              ))}
            </div>
          </>
        )}

        {!processing && events.length === 0 && !error && (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
              <FileX className="w-7 h-7 text-slate-400" />
            </div>
            <h3 className="text-sm font-semibold text-slate-700 mb-1">No data scanned yet</h3>
            <p className="text-xs text-slate-400 max-w-xl mx-auto">
              Upload any CSV, Excel, PDF, or DOCX payload. The engine normalizes global currencies to raw value + ISO 4217
              code, applies contextual baselines (no blanket high-value flagging), suppresses deterministic false positives
              for verified enterprise entities, and emits a currency-agnostic JSON webhook payload per document.
            </p>
          </div>
        )}
      </div>

      <BackToTop />
    </div>
  );
}

function Stat({ label, value, icon: Icon, tone }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3">
      <div className="flex items-center justify-between">
        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", tone)}><Icon className="w-3.5 h-3.5" /></div>
        <span className="text-xl font-bold text-[#231F20] tabular-nums">{value}</span>
      </div>
      <p className="text-[11px] text-slate-500 mt-1.5">{label}</p>
    </div>
  );
}