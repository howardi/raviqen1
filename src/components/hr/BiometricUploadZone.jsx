import React, { useState, useRef } from "react";
import { Fingerprint, UploadCloud, FileCheck, AlertTriangle, Loader2, X, ArrowRight } from "lucide-react";
import { parseBiometricFile, groupPunchesByEmployeeDate, detectBiometricAnomalies, biometricToAttendanceRecords } from "@/lib/biometricParser";
import { base44 } from "@/api/base44Client";
import { logActivity } from "@/lib/activityLogger";
import { stampTenant } from "@/lib/tenantScope";

const FIELD_LABELS = {
  employee_id: "Employee ID",
  timestamp: "Timestamp",
  device_id: "Device ID",
  punch_state: "Punch State",
  verification_type: "Verification Type",
};

const SUPPORTED_FORMATS = ".csv,.txt,.dat,.log,.xlsx";

export default function BiometricUploadZone({ onIngested, employees = [], user }) {
  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [parseResult, setParseResult] = useState(null);
  const [mapping, setMapping] = useState({});
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const inputRef = useRef(null);

  const handleFile = async (file) => {
    setError(null);
    setResult(null);
    setParseResult(null);
    if (!file) return;

    const ext = file.name.split(".").pop().toLowerCase();
    if (!["csv", "txt", "dat", "log", "xlsx"].includes(ext)) {
      setError(`Unsupported format: .${ext}. Supported: CSV, TXT, DAT, LOG, XLSX`);
      return;
    }

    setParsing(true);
    try {
      const text = await file.text();
      const parsed = parseBiometricFile(text, file.name);
      if (parsed.records.length === 0) {
        setError("No valid records found in file. Ensure it contains employee ID and timestamp columns.");
        setParsing(false);
        return;
      }
      setParseResult(parsed);
      setMapping(parsed.mapping);
    } catch (e) {
      setError(`Failed to parse file: ${e.message}`);
    }
    setParsing(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleConfirm = async () => {
    setIngesting(true);
    setError(null);
    try {
      // Re-parse with updated mapping
      const records = parseResult.records.map((r) => ({
        ...r,
        employee_id: r.raw[mapping.employee_id] || "",
        timestamp: r.raw[mapping.timestamp] || "",
        device_id: r.raw[mapping.device_id] || "",
        punch_state: r.raw[mapping.punch_state] || "",
        verification_type: r.raw[mapping.verification_type] || "",
      })).filter((r) => r.employee_id && r.timestamp);

      const grouped = groupPunchesByEmployeeDate(records);
      const anomalies = detectBiometricAnomalies(grouped);
      const attendanceRecords = biometricToAttendanceRecords(grouped, employees);

      // Bulk create attendance records
      let created = 0;
      let failed = 0;
      if (attendanceRecords.length > 0) {
        try {
          const res = await base44.entities.AttendanceRecord.bulkCreate(attendanceRecords.map((r) => stampTenant(r, user)));
          created = res.length;
        } catch (e) {
          // Fallback: create one by one
          for (const r of attendanceRecords) {
            try { await base44.entities.AttendanceRecord.create(stampTenant(r, user)); created++; }
            catch { failed++; }
          }
        }
      }

      // Create HR alerts for biometric anomalies
      const anomalyAlerts = anomalies.slice(0, 20).map((a) => ({
        alert_type: "attendance_anomaly",
        employee_id: a.employee_id,
        employee_name: employees.find((e) => e.employee_id === a.employee_id)?.full_name || a.employee_id,
        department: employees.find((e) => e.employee_id === a.employee_id)?.department || "general",
        severity: a.type === "duplicate_punch" || a.type === "multi_device_rapid_punch" ? "high" : "medium",
        description: `Biometric: ${a.detail}`,
        status: "open",
        evidence: [{ type: a.type, detail: a.detail, date: a.date }],
      }));
      if (anomalyAlerts.length > 0) {
        try { await base44.entities.HRAlert.bulkCreate(anomalyAlerts.map((a) => stampTenant(a, user))); } catch (e) { console.error(e); }
      }

      await logActivity(user, "biometric_ingestion", `Ingested ${created} biometric attendance records from ${parseResult.records.length} raw punches. ${anomalies.length} anomalies detected.`, "AttendanceRecord");

      setResult({
        total_punches: parseResult.records.length,
        grouped_days: grouped.length,
        attendance_created: created,
        anomalies: anomalies.length,
        failed,
      });
      setParseResult(null);
      if (onIngested) onIngested();
    } catch (e) {
      setError(`Ingestion failed: ${e.message}`);
    }
    setIngesting(false);
  };

  const updateMapping = (field, value) => {
    setMapping((m) => ({ ...m, [field]: value === "" ? undefined : parseInt(value) }));
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
          <Fingerprint className="w-4 h-4 text-indigo-600" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[#231F20]">Biometric Attendance Ingestion</h3>
          <p className="text-xs text-slate-500">Upload raw punch logs from ZKTeco, Suprema, Hikvision, Anviz, Dahua devices</p>
        </div>
      </div>

      {!parseResult && !result && (
        <>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
              dragging ? "border-indigo-400 bg-indigo-50" : "border-slate-300 hover:border-slate-400"
            }`}
          >
            {parsing ? (
              <div className="flex items-center justify-center gap-2 text-slate-500">
                <Loader2 className="w-5 h-5 animate-spin" /> Parsing biometric file…
              </div>
            ) : (
              <>
                <UploadCloud className="w-7 h-7 mx-auto text-slate-400 mb-2" />
                <p className="text-sm text-slate-600 font-medium">Drag & drop biometric export here</p>
                <p className="text-xs text-slate-400 mt-1">Supports: .CSV, .TXT, .DAT, .LOG, .XLSX</p>
                <button className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800">
                  Browse File
                </button>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              accept={SUPPORTED_FORMATS}
              className="hidden"
              onChange={(e) => handleFile(e.target.files[0])}
            />
          </div>
          {error && (
            <div className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
              <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}
        </>
      )}

      {/* Column mapping preview */}
      {parseResult && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-emerald-600" />
              <span className="text-sm font-medium text-slate-700">
                Parsed {parseResult.records.length} records from {parseResult.headers.length} columns
              </span>
            </div>
            <button onClick={() => setParseResult(null)} className="p-1 rounded hover:bg-slate-100">
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          <div className="bg-slate-50 rounded-lg p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Column Mapping</p>
            <p className="text-xs text-slate-400 -mt-2">Verify or adjust the auto-detected field mapping:</p>
            {Object.keys(FIELD_LABELS).map((field) => (
              <div key={field} className="flex items-center gap-3">
                <span className="text-xs font-medium text-slate-600 w-36">{FIELD_LABELS[field]}</span>
                <ArrowRight className="w-3 h-3 text-slate-400" />
                <select
                  value={mapping[field] ?? ""}
                  onChange={(e) => updateMapping(field, e.target.value)}
                  className="flex-1 text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-white"
                >
                  <option value="">— Not mapped —</option>
                  {parseResult.headers.map((h, i) => (
                    <option key={i} value={i}>{h} (col {i + 1})</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {/* Preview rows */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-1.5 px-2 font-medium text-slate-500">#</th>
                  {Object.keys(FIELD_LABELS).map((f) => (
                    <th key={f} className="text-left py-1.5 px-2 font-medium text-slate-500">{FIELD_LABELS[f]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parseResult.records.slice(0, 5).map((r, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-1.5 px-2 text-slate-400">{r.row_index}</td>
                    <td className="py-1.5 px-2 text-slate-700">{r.raw[mapping.employee_id] || "—"}</td>
                    <td className="py-1.5 px-2 text-slate-700">{r.raw[mapping.timestamp] || "—"}</td>
                    <td className="py-1.5 px-2 text-slate-700">{r.raw[mapping.device_id] || "—"}</td>
                    <td className="py-1.5 px-2 text-slate-700">{r.raw[mapping.punch_state] || "—"}</td>
                    <td className="py-1.5 px-2 text-slate-700">{r.raw[mapping.verification_type] || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={handleConfirm}
            disabled={ingesting || mapping.employee_id === undefined || mapping.timestamp === undefined}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {ingesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Fingerprint className="w-4 h-4" />}
            {ingesting ? "Processing biometric data…" : `Confirm & Ingest ${parseResult.records.length} Records`}
          </button>
        </div>
      )}

      {/* Result summary */}
      {result && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-emerald-600" />
              <span className="text-sm font-medium text-emerald-900">Biometric Ingestion Complete</span>
            </div>
            <button onClick={() => setResult(null)} className="p-1 rounded hover:bg-emerald-100">
              <X className="w-4 h-4 text-emerald-600" />
            </button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="text-slate-600">Raw Punches: <span className="font-semibold text-slate-800">{result.total_punches}</span></div>
            <div className="text-slate-600">Attendance Days: <span className="font-semibold text-slate-800">{result.grouped_days}</span></div>
            <div className="text-slate-600">Records Created: <span className="font-semibold text-emerald-700">{result.attendance_created}</span></div>
            <div className="text-slate-600">Anomalies Detected: <span className="font-semibold text-amber-700">{result.anomalies}</span></div>
          </div>
          {result.failed > 0 && (
            <p className="mt-2 text-xs text-red-600">{result.failed} records failed to save</p>
          )}
        </div>
      )}
    </div>
  );
}