import React, { useState, useMemo } from "react";
import { Search, Download, Calendar, Clock } from "lucide-react";
import { exportAttendanceSheetCSV } from "@/lib/hrExports";

const STATUS_CONFIG = {
  present: { label: "Present", classes: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  late: { label: "Late", classes: "bg-amber-50 text-amber-700 border-amber-200" },
  absent: { label: "Absent", classes: "bg-red-50 text-red-700 border-red-200" },
  sick_leave: { label: "Sick Leave", classes: "bg-blue-50 text-blue-700 border-blue-200" },
  overtime: { label: "Overtime", classes: "bg-violet-50 text-violet-700 border-violet-200" },
};

export default function AttendanceLogTable({ records, loading }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [deptFilter, setDeptFilter] = useState("");

  const filtered = useMemo(() => {
    return records.filter((r) => {
      if (search) {
        const q = search.toLowerCase();
        if (!r.employee_name?.toLowerCase().includes(q) && !r.employee_id?.toLowerCase().includes(q)) return false;
      }
      if (statusFilter && r.status !== statusFilter) return false;
      if (deptFilter && r.department !== deptFilter) return false;
      return true;
    });
  }, [records, search, statusFilter, deptFilter]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-100 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="text-sm font-semibold text-[#231F20] flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-500" /> Attendance Log
            <span className="text-xs font-normal text-slate-400">({filtered.length} records)</span>
          </h3>
          <button
            onClick={() => exportAttendanceSheetCSV(filtered, { month: "" })}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium hover:bg-slate-200 disabled:opacity-50 transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[160px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search employee…"
              className="w-full text-sm pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 outline-none focus:border-slate-400"
            />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="text-sm px-3 py-1.5 rounded-lg border border-slate-200 outline-none bg-white">
            <option value="">All Statuses</option>
            {Object.entries(STATUS_CONFIG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
          </select>
          <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="text-sm px-3 py-1.5 rounded-lg border border-slate-200 outline-none bg-white">
            <option value="">All Departments</option>
            <option value="restaurant">Restaurant</option>
            <option value="operations">Operations</option>
            <option value="front_desk">Front Desk</option>
            <option value="hr">HR</option>
            <option value="finance">Finance</option>
            <option value="general">General</option>
          </select>
          {(search || statusFilter || deptFilter) && (
            <button onClick={() => { setSearch(""); setStatusFilter(""); setDeptFilter(""); }} className="text-xs text-slate-500 hover:text-slate-900">Clear</button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto max-h-96 overflow-y-auto">
        {loading ? (
          <div className="p-4 space-y-2">{[1, 2, 3, 4].map((i) => <div key={i} className="h-10 rounded-lg bg-slate-100 animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10">
            <Calendar className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <p className="text-sm text-slate-400">No attendance records yet</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50/95 backdrop-blur">
              <tr className="text-xs text-slate-500 uppercase tracking-wide">
                <th className="text-left px-4 py-2.5 font-medium">Employee</th>
                <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell">Date</th>
                <th className="text-left px-4 py-2.5 font-medium">In</th>
                <th className="text-left px-4 py-2.5 font-medium">Out</th>
                <th className="text-left px-4 py-2.5 font-medium">Status</th>
                <th className="text-right px-4 py-2.5 font-medium hidden md:table-cell">Hours</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.slice(0, 100).map((r) => {
                const sc = STATUS_CONFIG[r.status] || STATUS_CONFIG.present;
                return (
                  <tr key={r.id} className={`hover:bg-slate-50/60 transition-colors ${r.anomaly_flags?.length > 0 ? "bg-amber-50/30" : ""}`}>
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-[#231F20] text-xs truncate">{r.employee_name || r.employee_id}</p>
                      <p className="text-[10px] text-slate-400">{r.employee_id}</p>
                    </td>
                    <td className="px-4 py-2.5 hidden sm:table-cell text-slate-500 text-xs">{r.date}</td>
                    <td className="px-4 py-2.5 text-slate-600 text-xs">{r.clock_in_time || "—"}</td>
                    <td className="px-4 py-2.5 text-slate-600 text-xs">{r.clock_out_time || "—"}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${sc.classes}`}>{sc.label}</span>
                      {r.anomaly_flags?.length > 0 && <span className="ml-1 text-[10px] text-amber-600">⚠ {r.anomaly_flags.length}</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-500 text-xs hidden md:table-cell">{r.hours_worked || 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}