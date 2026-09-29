import React, { useState, useMemo } from "react";
import { Search, Eye, Download, FileText, AlertTriangle, CheckCircle2, X } from "lucide-react";
import RiskBadge from "@/components/RiskBadge";
import { downloadPayslipPDF } from "@/lib/payrollExports";
import { useCompanyProfile } from "@/lib/CompanyProfileContext";

const STATUS_STYLES = {
  draft: "bg-slate-100 text-slate-600",
  reviewed: "bg-blue-100 text-blue-700",
  approved: "bg-emerald-100 text-emerald-700",
  disbursed: "bg-teal-100 text-teal-700",
  flagged: "bg-red-100 text-red-700",
};

const ANOMALY_LABELS = {
  ghost_worker_zero_attendance: "Ghost Worker",
  excessive_overtime_ratio: "Excessive OT",
  chronic_tardiness: "Chronic Tardiness",
  excessive_absenteeism: "Excessive Absence",
  manual_override_dominant: "Manual Override",
};

export default function PayrollTable({ records = [], employees = [], loading, onApprove, onFlag }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const { profile } = useCompanyProfile();

  const filtered = useMemo(() => {
    return records.filter((r) => {
      const matchSearch = !search ||
        r.employee_name?.toLowerCase().includes(search.toLowerCase()) ||
        r.employee_id?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || r.status === statusFilter;
      const matchRisk = riskFilter === "all" || r.risk_level === riskFilter;
      return matchSearch && matchStatus && matchRisk;
    });
  }, [records, search, statusFilter, riskFilter]);

  const selectedEmployee = selected ? employees.find((e) => e.employee_id === selected.employee_id) : null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-100">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search employee…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-300"
            />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white">
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="reviewed">Reviewed</option>
            <option value="approved">Approved</option>
            <option value="disbursed">Disbursed</option>
            <option value="flagged">Flagged</option>
          </select>
          <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white">
            <option value="all">All Risk Levels</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="p-8 space-y-2">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-12 rounded-lg bg-slate-100 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="w-8 h-8 mx-auto text-slate-300 mb-2" />
          <p className="text-sm text-slate-400">No payroll records found</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-left py-2.5 px-4 font-medium text-slate-500 text-xs uppercase">Employee</th>
                <th className="text-left py-2.5 px-4 font-medium text-slate-500 text-xs uppercase">Dept</th>
                <th className="text-right py-2.5 px-4 font-medium text-slate-500 text-xs uppercase">Days</th>
                <th className="text-right py-2.5 px-4 font-medium text-slate-500 text-xs uppercase">OT Hrs</th>
                <th className="text-right py-2.5 px-4 font-medium text-slate-500 text-xs uppercase">Gross</th>
                <th className="text-right py-2.5 px-4 font-medium text-slate-500 text-xs uppercase">Deduct</th>
                <th className="text-right py-2.5 px-4 font-medium text-slate-500 text-xs uppercase">Net Pay</th>
                <th className="text-center py-2.5 px-4 font-medium text-slate-500 text-xs uppercase">Risk</th>
                <th className="text-center py-2.5 px-4 font-medium text-slate-500 text-xs uppercase">Status</th>
                <th className="text-right py-2.5 px-4 font-medium text-slate-500 text-xs uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id || r.employee_id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="py-2.5 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-semibold text-slate-600">
                        {r.employee_name?.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-slate-800 text-xs">{r.employee_name}</p>
                        <p className="text-[10px] text-slate-400">{r.employee_id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 px-4 text-xs text-slate-600 capitalize">{r.department}</td>
                  <td className="py-2.5 px-4 text-right text-xs tabular-nums text-slate-700">{r.days_worked}/{r.scheduled_days}</td>
                  <td className="py-2.5 px-4 text-right text-xs tabular-nums text-slate-700">{r.overtime_hours}</td>
                  <td className="py-2.5 px-4 text-right text-xs tabular-nums text-slate-700">${r.gross_pay?.toFixed(2)}</td>
                  <td className="py-2.5 px-4 text-right text-xs tabular-nums text-red-600">-${r.total_deductions?.toFixed(2)}</td>
                  <td className="py-2.5 px-4 text-right text-xs tabular-nums font-semibold text-slate-900">${r.net_pay?.toFixed(2)}</td>
                  <td className="py-2.5 px-4 text-center"><RiskBadge level={r.risk_level} size="sm" showIcon={false} /></td>
                  <td className="py-2.5 px-4 text-center">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[r.status] || STATUS_STYLES.draft}`}>{r.status}</span>
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setSelected(r)} className="p-1.5 rounded hover:bg-slate-100" title="View details">
                        <Eye className="w-3.5 h-3.5 text-slate-500" />
                      </button>
                      <button onClick={() => downloadPayslipPDF(r, selectedEmployee || employees.find((e) => e.employee_id === r.employee_id), profile)} className="p-1.5 rounded hover:bg-slate-100" title="Download payslip">
                        <Download className="w-3.5 h-3.5 text-slate-500" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail drawer */}
      {selected && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setSelected(null)} />
          <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white z-50 overflow-y-auto shadow-xl">
            <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#231F20]">Payroll Details</h3>
              <button onClick={() => setSelected(null)} className="p-1 rounded hover:bg-slate-100">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* Employee info */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-sm font-semibold text-slate-600">
                  {selected.employee_name?.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{selected.employee_name}</p>
                  <p className="text-xs text-slate-400">{selected.employee_id} · {selected.department}</p>
                </div>
                <div className="ml-auto"><RiskBadge level={selected.risk_level} size="sm" /></div>
              </div>

              {/* Anomaly flags */}
              {selected.anomaly_flags?.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                    <span className="text-xs font-semibold text-red-700">Risk Flags ({selected.anomaly_flags.length})</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {selected.anomaly_flags.map((f) => (
                      <span key={f} className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                        {ANOMALY_LABELS[f] || f}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Earnings breakdown */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-slate-500 uppercase">Earnings</h4>
                <div className="flex justify-between text-xs"><span className="text-slate-600">Base Salary ({selected.days_worked}/{selected.scheduled_days} days)</span><span className="font-medium tabular-nums">${selected.base_salary?.toFixed(2)}</span></div>
                <div className="flex justify-between text-xs"><span className="text-slate-600">Hourly Rate</span><span className="font-medium tabular-nums">${selected.hourly_rate?.toFixed(2)}/hr</span></div>
                <div className="flex justify-between text-xs"><span className="text-slate-600">Regular Hours</span><span className="font-medium tabular-nums">{selected.regular_hours}h</span></div>
                <div className="flex justify-between text-xs"><span className="text-slate-600">Overtime ({selected.overtime_hours}h)</span><span className="font-medium tabular-nums">${selected.overtime_pay?.toFixed(2)}</span></div>
                <div className="flex justify-between text-xs pt-1 border-t border-slate-100"><span className="font-semibold text-slate-700">Gross Pay</span><span className="font-bold tabular-nums text-slate-900">${selected.gross_pay?.toFixed(2)}</span></div>
              </div>

              {/* Deductions */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-slate-500 uppercase">Deductions</h4>
                <div className="flex justify-between text-xs"><span className="text-slate-600">Late Arrivals ({selected.late_count})</span><span className="text-red-600 tabular-nums">-${selected.late_deduction?.toFixed(2)}</span></div>
                <div className="flex justify-between text-xs"><span className="text-slate-600">Absences ({selected.absent_days} days)</span><span className="text-red-600 tabular-nums">-${selected.absence_deduction?.toFixed(2)}</span></div>
                <div className="flex justify-between text-xs pt-1 border-t border-slate-100"><span className="font-semibold text-slate-700">Total Deductions</span><span className="font-bold tabular-nums text-red-600">-${selected.total_deductions?.toFixed(2)}</span></div>
              </div>

              {/* Net pay */}
              <div className="bg-slate-900 rounded-lg p-3 flex justify-between items-center">
                <span className="text-sm text-white font-medium">NET PAY</span>
                <span className="text-lg font-bold text-white tabular-nums">${selected.net_pay?.toFixed(2)}</span>
              </div>

              {/* Attendance summary */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-slate-50 rounded-lg p-2">
                  <p className="text-lg font-bold text-slate-700">{selected.attendance_summary?.present || 0}</p>
                  <p className="text-[10px] text-slate-400">Present</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2">
                  <p className="text-lg font-bold text-amber-600">{selected.attendance_summary?.late || 0}</p>
                  <p className="text-[10px] text-slate-400">Late</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2">
                  <p className="text-lg font-bold text-red-600">{selected.attendance_summary?.absent || 0}</p>
                  <p className="text-[10px] text-slate-400">Absent</p>
                </div>
              </div>

              {/* Biometric verification */}
              <div className="bg-indigo-50 rounded-lg p-3">
                <h4 className="text-xs font-semibold text-indigo-700 mb-2">Biometric Verification</h4>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div><p className="text-sm font-bold text-indigo-700">{selected.biometric_verification?.biometric_verified || 0}</p><p className="text-[10px] text-indigo-500">Biometric</p></div>
                  <div><p className="text-sm font-bold text-amber-600">{selected.biometric_verification?.manual_entry || 0}</p><p className="text-[10px] text-amber-500">Manual</p></div>
                  <div><p className="text-sm font-bold text-slate-600">{selected.biometric_verification?.csv_upload || 0}</p><p className="text-[10px] text-slate-400">CSV</p></div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => downloadPayslipPDF(selected, selectedEmployee, profile)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800"
                >
                  <Download className="w-3.5 h-3.5" /> Download Payslip
                </button>
                {selected.status === "draft" && onApprove && (
                  <button
                    onClick={() => { onApprove(selected); setSelected(null); }}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                  </button>
                )}
                {selected.anomaly_flags?.length > 0 && onFlag && (
                  <button
                    onClick={() => { onFlag(selected); setSelected(null); }}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" /> Flag
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}