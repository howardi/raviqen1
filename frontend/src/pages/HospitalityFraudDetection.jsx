import React, { useState, useRef } from "react";
import { useAuth } from "@/lib/AuthContext";
import { logActivity } from "@/lib/activityLogger";
import { runHospitalityFraudDetection, extractOperationalRecords, persistFraudAlerts } from "@/lib/hospitalityFraudEngine";
import FraudAlertCard from "@/components/hospitality/FraudAlertCard";
import FraudScanFeed from "@/components/hospitality/FraudScanFeed";
import BackToTop from "@/components/BackToTop";
import { base44 } from "@/api/base44Client";
import { Hotel, Upload, Loader2, FileX, ShieldX, ShieldAlert, AlertTriangle, Building2, UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/utils";

export default function HospitalityFraudDetection() {
  const { user } = useAuth();
  const fileInput = useRef(null);
  const [processing, setProcessing] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [detectedTypes, setDetectedTypes] = useState([]);
  const [phaseErrors, setPhaseErrors] = useState([]);
  const [dataQuality, setDataQuality] = useState([]);
  const [error, setError] = useState(null);
  const [savedCount, setSavedCount] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [filter, setFilter] = useState("ALL");

  const handleFile = async (file) => {
    if (!file) return;
    setProcessing(true);
    setError(null);
    setAlerts([]);
    setSavedCount(null);
    setDetectedTypes([]);
    setPhaseErrors([]);
    setDataQuality([]);
    try {
      let fileUrl = null;
      // Only upload when backend extraction is needed (Excel/PDF/images)
      const ext = (file.name || "").toLowerCase().split(".").pop() || "";
      if (!["csv", "tsv", "txt"].includes(ext)) {
        const up = await base44.integrations.Core.UploadPrivateFile({ file });
        fileUrl = (await base44.integrations.Core.CreateFileSignedUrl({ file_uri: up.file_uri })).signed_url;
      }
      const records = await extractOperationalRecords(fileUrl, file);
      if (!records || records.length === 0) {
        setError("No records could be extracted from the uploaded file. Ensure the file contains operational data (PMS, POS, or HR/Expense columns).");
        setProcessing(false);
        return;
      }
      const { alerts: detected, detectedTypes: types, errors: pErrs = [], dataQualityIssues = [] } = runHospitalityFraudDetection(records);
      setAlerts(detected);
      setDetectedTypes(types);
      setPhaseErrors(pErrs);
      setDataQuality(dataQualityIssues);
      if (detected.length) {
        const count = await persistFraudAlerts(detected, user, file.name);
        setSavedCount(count);
        setRefreshKey((n) => n + 1);
      }
      await logActivity(user, "hospitality_fraud_scan", `Scanned ${file.name}: ${records.length} records → ${detected.length} fraud alert(s), ${dataQualityIssues.length} data-quality issue(s)`, "FraudAlert", null);
    } catch (e) {
      console.error(e);
      setError(e.message || "Screening failed. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  const stats = {
    total: alerts.length,
    critical: alerts.filter((a) => a.overall_risk_level === "CRITICAL").length,
    high: alerts.filter((a) => a.overall_risk_level === "HIGH").length,
    medium: alerts.filter((a) => a.overall_risk_level === "MEDIUM").length,
  };

  const filtered = filter === "ALL" ? alerts : alerts.filter((a) => a.department === filter);

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-slate-200 px-4 md:px-8 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-lg font-bold text-[#231F20] flex items-center gap-2">
              <Hotel className="w-5 h-5 text-slate-700" />
              Enterprise & Hospitality Fraud Detection Engine
            </h1>
            <p className="text-xs text-slate-500">
              Hotel PMS · Restaurant POS · Corporate HR/Expense — behavioral analytics for skimming, inventory theft & internal fraud
            </p>
          </div>
          <button
            onClick={() => fileInput.current?.click()}
            disabled={processing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-sm"
          >
            <Upload className="w-4 h-4" />
            Ingest Operational Data
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".csv,.tsv,.txt,.xlsx,.xls,.pdf"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
          />
        </div>
      </header>

      <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
        {/* Detected systems */}
        {detectedTypes.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-400">Detected systems:</span>
            {detectedTypes.map((t) => {
              const meta = t === "Front_Desk" ? { icon: Hotel, label: "Hotel PMS" } : t === "Restaurant_POS" ? { icon: UtensilsCrossed, label: "Restaurant POS" } : { icon: Building2, label: "Corporate HR" };
              const Icon = meta.icon;
              return (
                <span key={t} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-medium">
                  <Icon className="w-3.5 h-3.5" />
                  {meta.label}
                </span>
              );
            })}
          </div>
        )}

        {/* Data quality & phase errors */}
        {dataQuality.length > 0 && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <h3 className="text-sm font-semibold text-amber-800">Data Quality & Error Detection — {dataQuality.length} issue(s) found</h3>
            </div>
            <p className="text-xs text-amber-700 mb-3">Structural defects that could silently mask fraud or zero-out metric calculations. These records were skipped by the relevant behavioral rules.</p>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {dataQuality.slice(0, 50).map((q, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className={cn("shrink-0 px-1.5 py-0.5 rounded font-medium", q.severity === "MEDIUM" ? "bg-amber-200 text-amber-800" : "bg-amber-100 text-amber-700")}>{q.severity}</span>
                  <span className="text-slate-500 shrink-0">Row {q.row} · {q.field}</span>
                  <span className="text-slate-700">{q.issue}</span>
                </div>
              ))}
              {dataQuality.length > 50 && <p className="text-[11px] text-amber-600 pt-1">+{dataQuality.length - 50} more…</p>}
            </div>
          </div>
        )}

        {phaseErrors.length > 0 && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <ShieldAlert className="w-4 h-4 text-red-600" />
              <h3 className="text-sm font-semibold text-red-800">Phase Execution Errors — {phaseErrors.length}</h3>
            </div>
            <div className="space-y-1">
              {phaseErrors.map((e, i) => (
                <div key={i} className="text-xs text-red-700">
                  <span className="font-mono">{e.phase}</span>: {e.message}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Summary stats */}
        {alerts.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Total Alerts" value={stats.total} icon={ShieldAlert} tone="bg-slate-100 text-slate-700" />
            <StatCard label="Critical" value={stats.critical} icon={ShieldX} tone="bg-red-50 text-red-700" />
            <StatCard label="High" value={stats.high} icon={ShieldAlert} tone="bg-orange-50 text-orange-700" />
            <StatCard label="Medium" value={stats.medium} icon={AlertTriangle} tone="bg-amber-50 text-amber-700" />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2.5 p-4 rounded-xl bg-red-50 border border-red-200">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Processing */}
        {processing && (
          <div className="flex flex-col items-center gap-3 py-10">
            <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
            <p className="text-xs text-slate-400">Extracting records and running behavioral analytics…</p>
          </div>
        )}

        {/* Filter + results */}
        {alerts.length > 0 && (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              {["ALL", "Front_Desk", "Restaurant_POS", "Corporate_HR"].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                    filter === f ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  )}
                >
                  {f === "ALL" ? "All Departments" : f === "Front_Desk" ? "Front Desk" : f === "Restaurant_POS" ? "Restaurant POS" : "Corporate HR"}
                  <span className="ml-1.5 text-[10px] opacity-70">
                    {f === "ALL" ? alerts.length : alerts.filter((a) => a.department === f).length}
                  </span>
                </button>
              ))}
            </div>

            <div className="space-y-2.5">
              {filtered.map((a, i) => (
                <FraudAlertCard key={`${a.event_id}-${i}`} alert={a} />
              ))}
            </div>

            {savedCount !== null && <p role="status" className="text-xs text-emerald-700">{savedCount} alert(s) saved to scan findings.</p>}
          </>
        )}

        <FraudScanFeed refreshKey={refreshKey} />

        {/* Empty state */}
        {!processing && alerts.length === 0 && !error && (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
              <FileX className="w-7 h-7 text-slate-400" />
            </div>
            <h3 className="text-sm font-semibold text-slate-700 mb-1">No operational file scanned in this session</h3>
            <p className="text-xs text-slate-400 max-w-xl mx-auto">
              Upload a CSV or Excel export from your Hotel PMS, Restaurant POS, or Corporate HR/Expense ledger. The engine
              auto-detects the source system and runs phase-specific behavioral analytics — front-desk skimming, POS void
              theft, and internal corporate fraud — outputting a structured risk payload per detected anomaly.
            </p>
          </div>
        )}
      </div>

      <BackToTop />
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between">
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", tone)}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-2xl font-bold text-[#231F20] tabular-nums">{value}</span>
      </div>
      <p className="text-xs text-slate-500 mt-2">{label}</p>
    </div>
  );
}