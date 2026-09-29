import React, { useState, useCallback } from "react";
import { UploadCloud, Fingerprint, Loader2, CheckCircle2, AlertTriangle, X, CalendarClock } from "lucide-react";
import { detectAttendanceAnomalies } from "@/lib/attendanceEngine";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { stampTenant } from "@/lib/tenantScope";

export default function AttendanceUploadZone({ onIngested, employees }) {
  const { user } = useAuth();
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const handleFile = useCallback(async (file) => {
    setProcessing(true);
    setError("");
    setResult(null);
    try {
      const text = await file.text();
      const rows = parseCSV(text);
      if (rows.length === 0) throw new Error("No data rows found in attendance file");

      const batchId = `ATT-${Date.now()}`;
      const records = rows.map((r) => normalizeAttendanceRow(r, employees));
      const valid = records.filter((r) => r.employee_id && r.date);

      if (valid.length === 0) throw new Error("No valid attendance records — ensure employee_id and date columns exist");

      // Bulk create attendance records
      const created = await base44.entities.AttendanceRecord.bulkCreate(
        valid.map((r) => stampTenant({ ...r, batch_id: batchId, source: "csv_upload" }, user))
      );

      // Run anomaly detection
      const allRecords = await base44.entities.AttendanceRecord.list("-created_date", 500);
      const anomalies = detectAttendanceAnomalies(allRecords);

      // Create HR alerts for anomalies
      const alertsToCreate = [];
      for (const a of anomalies) {
        for (const an of a.anomalies) {
          alertsToCreate.push({
            alert_type: an.type === "chronic_tardiness" ? "chronic_absenteeism" : an.type === "chronic_absenteeism" ? "chronic_absenteeism" : "attendance_anomaly",
            employee_id: a.employee_id,
            employee_name: a.employee_name,
            department: a.department,
            severity: an.severity,
            description: an.description,
            evidence: [{ date: a.date, detail: an.description, record_id: a.record_id }],
            status: "open",
            linked_attendance_ids: a.record_id ? [a.record_id] : [],
          });
        }
      }
      if (alertsToCreate.length > 0) {
        await base44.entities.HRAlert.bulkCreate(alertsToCreate.map((a) => stampTenant(a, user)));
      }

      setResult({ ingested: valid.length, anomalies: anomalies.length, alerts: alertsToCreate.length, batchId });
      if (onIngested) onIngested();
    } catch (e) {
      setError(e.message || "Failed to process attendance file");
    }
    setProcessing(false);
  }, [onIngested, employees, user]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center">
          <Fingerprint className="w-4 h-4 text-teal-600" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[#231F20]">Attendance & Shift Log Ingestion</h3>
          <p className="text-[11px] text-slate-400">Upload CSV/XLSX or sync biometric data. Required: employee_id, date, clock_in_time, clock_out_time, status</p>
        </div>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
        className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
          dragging ? "border-teal-400 bg-teal-50" : "border-slate-200 hover:border-slate-300"
        }`}
      >
        {processing ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-6 h-6 text-teal-600 animate-spin" />
            <p className="text-sm text-slate-600">Processing attendance records & running anomaly detection…</p>
          </div>
        ) : (
          <>
            <CalendarClock className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <p className="text-sm text-slate-500 mb-1">Drag & drop attendance CSV/XLSX here</p>
            <p className="text-xs text-slate-400 mb-3">or</p>
            <label className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 cursor-pointer transition-colors">
              <UploadCloud className="w-3.5 h-3.5" /> Browse File
              <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files[0]; if (f) handleFile(f); }} />
            </label>
          </>
        )}
      </div>

      {error && (
        <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      {result && (
        <div className="mt-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <p className="text-sm font-medium text-emerald-700">Attendance Ingestion Complete</p>
            <button onClick={() => setResult(null)} className="ml-auto"><X className="w-3.5 h-3.5 text-emerald-600" /></button>
          </div>
          <div className="flex gap-4 text-xs text-emerald-600 flex-wrap">
            <span>Records: {result.ingested}</span>
            <span>Anomalies Detected: {result.anomalies}</span>
            <span className={result.alerts > 0 ? "text-amber-600 font-medium" : ""}>HR Alerts Generated: {result.alerts}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    const row = {};
    headers.forEach((h, i) => { row[h] = values[i] || ""; });
    return row;
  }).filter((r) => Object.values(r).some((v) => v));
}

function normalizeAttendanceRow(row, employees) {
  const empId = row.employee_id || row.emp_id || row.id || "";
  const emp = employees?.find((e) => e.employee_id === empId);
  let status = (row.status || "present").toLowerCase();
  if (status.includes("present")) status = "present";
  else if (status.includes("late") || status.includes("tardy")) status = "late";
  else if (status.includes("absent")) status = "absent";
  else if (status.includes("sick") || status.includes("medical")) status = "sick_leave";
  else if (status.includes("overtime") || status.includes("ot")) status = "overtime";

  let hours = 0;
  if (row.hours_worked) hours = parseFloat(row.hours_worked) || 0;
  else if (row.clock_in_time && row.clock_out_time) {
    const inMin = parseTime(row.clock_in_time);
    const outMin = parseTime(row.clock_out_time);
    if (inMin !== null && outMin !== null) {
      let diff = outMin - inMin;
      if (diff < 0) diff += 24 * 60;
      hours = Math.round((diff / 60) * 10) / 10;
    }
  }

  return {
    employee_id: empId,
    employee_name: emp?.full_name || row.employee_name || row.name || "",
    department: emp?.department || normalizeDept(row.department || emp?.department || "general"),
    date: row.date || "",
    clock_in_time: row.clock_in_time || row.clock_in || row.time_in || "",
    clock_out_time: row.clock_out_time || row.clock_out || row.time_out || "",
    status,
    hours_worked: hours,
  };
}

function parseTime(t) {
  if (!t) return null;
  const m = t.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!m) return null;
  let h = parseInt(m[1]); const min = parseInt(m[2]);
  const mer = m[3]?.toUpperCase();
  if (mer === "PM" && h !== 12) h += 12;
  if (mer === "AM" && h === 12) h = 0;
  return h * 60 + min;
}

function normalizeDept(d) {
  const s = String(d || "").toLowerCase();
  if (s.includes("restaurant") || s.includes("f&b")) return "restaurant";
  if (s.includes("operation")) return "operations";
  if (s.includes("front") || s.includes("desk")) return "front_desk";
  if (s.includes("hr")) return "hr";
  if (s.includes("finance")) return "finance";
  return "general";
}