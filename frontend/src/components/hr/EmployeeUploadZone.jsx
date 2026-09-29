import React, { useState, useCallback } from "react";
import { UploadCloud, FileSpreadsheet, Loader2, CheckCircle2, AlertTriangle, X } from "lucide-react";
import { ingestEmployeeRows } from "@/lib/employeeIngestion";

export default function EmployeeUploadZone({ onIngested, user }) {
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
      if (rows.length === 0) throw new Error("No data rows found in file");
      const res = await ingestEmployeeRows(rows, user);
      setResult(res);
      if (onIngested) onIngested();
    } catch (e) {
      setError(e.message || "Failed to process file");
    }
    setProcessing(false);
  }, [onIngested, user]);

  const parseCSV = (text) => {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
    return lines.slice(1).map((line) => {
      const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
      const row = {};
      headers.forEach((h, i) => { row[h] = values[i] || ""; });
      return row;
    }).filter((r) => Object.values(r).some((v) => v));
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
          <UploadCloud className="w-4 h-4 text-blue-600" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[#231F20]">Employee Onboarding & Data Portal</h3>
          <p className="text-[11px] text-slate-400">Upload CSV/XLSX with employee records. Required: employee_id, full_name, department, role_title, date_of_joining, employment_status</p>
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
          dragging ? "border-blue-400 bg-blue-50" : "border-slate-200 hover:border-slate-300"
        }`}
      >
        {processing ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
            <p className="text-sm text-slate-600">Processing employee records…</p>
          </div>
        ) : (
          <>
            <FileSpreadsheet className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <p className="text-sm text-slate-500 mb-1">Drag & drop CSV/XLSX here</p>
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
            <p className="text-sm font-medium text-emerald-700">Ingestion Complete</p>
            <button onClick={() => setResult(null)} className="ml-auto"><X className="w-3.5 h-3.5 text-emerald-600" /></button>
          </div>
          <div className="flex gap-4 text-xs text-emerald-600">
            <span>Created: {result.created}</span>
            <span>Updated: {result.updated}</span>
            {result.failed > 0 && <span className="text-red-600">Failed: {result.failed}</span>}
          </div>
          {result.errors?.length > 0 && (
            <div className="mt-2 space-y-0.5 max-h-24 overflow-y-auto">
              {result.errors.slice(0, 5).map((e, i) => <p key={i} className="text-[10px] text-red-600">{e}</p>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}