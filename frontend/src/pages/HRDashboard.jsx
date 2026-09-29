import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import {
  ShieldCheck, UserCheck, UserX, AlertTriangle, Loader2, Users, Scan, FileSearch,
  Users2, CalendarClock, Fingerprint, Download, FileSpreadsheet, Bell, DollarSign, Banknote,
} from "lucide-react";
import BackgroundCheckForm from "@/components/hr/BackgroundCheckForm";
import BackgroundCheckResult from "@/components/hr/BackgroundCheckResult";
import EmployeeDirectory from "@/components/hr/EmployeeDirectory";
import EmployeeUploadZone from "@/components/hr/EmployeeUploadZone";
import AttendanceUploadZone from "@/components/hr/AttendanceUploadZone";
import AttendanceLogTable from "@/components/hr/AttendanceLogTable";
import HRAlertsPanel from "@/components/hr/HRAlertsPanel";
import BiometricUploadZone from "@/components/hr/BiometricUploadZone";
import PayrollOverviewPanel from "@/components/hr/PayrollOverviewPanel";
import PayrollTable from "@/components/hr/PayrollTable";
import PayrollConfigPanel from "@/components/hr/PayrollConfigPanel";
import BackToTop from "@/components/BackToTop";
import RiskBadge from "@/components/RiskBadge";
import { useAuth } from "@/lib/AuthContext";
import { logActivity } from "@/lib/activityLogger";
import { runBackgroundScreening } from "@/lib/backgroundScreening";
import { computeAttendanceRate, detectGhostWorkers } from "@/lib/attendanceEngine";
import { exportBackgroundCheckAuditCSV, exportAttendanceSummaryPDF } from "@/lib/hrExports";
import { useCompanyProfile } from "@/lib/CompanyProfileContext";
import { calculatePayroll, getPayrollSummary, DEFAULT_PAYROLL_CONFIG } from "@/lib/payrollEngine";
import { stampTenant } from "@/lib/tenantScope";
import { exportBankDisbursementCSV, exportPayrollAuditPDF, exportPayrollAuditCSV } from "@/lib/payrollExports";

const TABS = [
  { key: "overview", label: "Overview", icon: Users2 },
  { key: "employees", label: "Employee Directory", icon: Users },
  { key: "attendance", label: "Attendance", icon: Fingerprint },
  { key: "payroll", label: "Payroll", icon: DollarSign },
  { key: "screening", label: "Background Screening", icon: ShieldCheck },
  { key: "alerts", label: "HR Risk Alerts", icon: Bell },
];

export default function HRDashboard() {
  const [tab, setTab] = useState("overview");
  const [checks, setChecks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [hrAlerts, setHRAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [screening, setScreening] = useState(false);
  const [selectedCheck, setSelectedCheck] = useState(null);
  const [payrollRecords, setPayrollRecords] = useState([]);
  const [payrollConfig, setPayrollConfig] = useState(DEFAULT_PAYROLL_CONFIG);
  const [payrollPeriod, setPayrollPeriod] = useState({ month: new Date().toLocaleString("default", { month: "long" }), year: new Date().getFullYear() });
  const [generatingPayroll, setGeneratingPayroll] = useState(false);
  const { user } = useAuth();
  const { profile } = useCompanyProfile();

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    try {
      const [chk, emp, att, al, pr] = await Promise.all([
        base44.entities.BackgroundCheck.list("-created_date", 50),
        base44.entities.Employee.list("-created_date", 100),
        base44.entities.AttendanceRecord.list("-created_date", 200),
        base44.entities.HRAlert.list("-created_date", 50),
        base44.entities.PayrollRecord.list("-created_date", 100),
      ]);
      setChecks(chk);
      setEmployees(emp);
      setAttendance(att);
      setHRAlerts(al);
      setPayrollRecords(pr);
      if (chk.length > 0 && !selectedCheck) setSelectedCheck(chk[0]);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleScreening = async (candidateData) => {
    setScreening(true);
    try {
      const record = await base44.entities.BackgroundCheck.create(stampTenant({
        ...candidateData, overall_status: "in_progress", status: "screening",
      }, user));
      const results = await runBackgroundScreening(candidateData, user);
      await base44.entities.BackgroundCheck.update(record.id, results);
      await logActivity(user, "background_check", `Screened candidate: ${candidateData.candidate_name} — ${results.overall_status} (${results.risk_score}/100)`, "BackgroundCheck", record.id);
      await loadAll();
      const updated = await base44.entities.BackgroundCheck.get(record.id);
      setSelectedCheck(updated);
    } catch (e) { console.error(e); }
    setScreening(false);
  };

  const handleDismissAlert = async (alert) => {
    await base44.entities.HRAlert.update(alert.id, { status: "dismissed" });
    await loadAll();
  };

  const handleGeneratePayroll = async () => {
    setGeneratingPayroll(true);
    try {
      const calculated = calculatePayroll(employees, attendance, payrollConfig);
      const withPeriod = calculated.map((r) => ({
        ...r,
        pay_period_month: payrollPeriod.month,
        pay_period_year: payrollPeriod.year,
        generated_by: user?.full_name || user?.email || "system",
        generated_date: new Date().toISOString(),
      }));

      // Delete old draft records for this period
      const existing = payrollRecords.filter((r) => r.pay_period_month === payrollPeriod.month && r.pay_period_year === payrollPeriod.year && r.status === "draft");
      for (const r of existing) { try { await base44.entities.PayrollRecord.delete(r.id); } catch (e) {} }

      // Bulk create new records
      let created = [];
      if (withPeriod.length > 0) {
        try { created = await base44.entities.PayrollRecord.bulkCreate(withPeriod.map((r) => stampTenant(r, user))); }
        catch (e) { for (const r of withPeriod) { try { const rec = await base44.entities.PayrollRecord.create(stampTenant(r, user)); created.push(rec); } catch {} } }
      }

      await logActivity(user, "payroll_generation", `Generated payroll for ${withPeriod.length} employees — ${payrollPeriod.month} ${payrollPeriod.year}. Total net: $${withPeriod.reduce((s, r) => s + r.net_pay, 0).toFixed(2)}`, "PayrollRecord");
      await loadAll();
    } catch (e) { console.error(e); }
    setGeneratingPayroll(false);
  };

  const handleApprovePayroll = async (record) => {
    await base44.entities.PayrollRecord.update(record.id, { status: "approved", approved_by: user?.full_name || user?.email, approved_date: new Date().toISOString().split("T")[0] });
    await logActivity(user, "payroll_approval", `Approved payroll for ${record.employee_name} — $${record.net_pay?.toFixed(2)}`, "PayrollRecord", record.id);
    await loadAll();
  };

  const handleFlagPayroll = async (record) => {
    await base44.entities.PayrollRecord.update(record.id, { status: "flagged" });
    await base44.entities.HRAlert.create(stampTenant({
      alert_type: "attendance_anomaly",
      employee_id: record.employee_id,
      employee_name: record.employee_name,
      department: record.department,
      severity: record.risk_level === "critical" ? "critical" : "high",
      description: `Payroll anomaly: ${record.anomaly_flags?.join(", ") || "flagged for review"}`,
      status: "open",
      evidence: [{ type: "payroll_anomaly", flags: record.anomaly_flags, net_pay: record.net_pay }],
    }, user));
    await logActivity(user, "payroll_flag", `Flagged payroll for ${record.employee_name} — ${record.anomaly_flags?.join(", ")}`, "PayrollRecord", record.id);
    await loadAll();
  };

  const payrollSummary = useMemo(() => getPayrollSummary(
    payrollRecords.filter((r) => r.pay_period_month === payrollPeriod.month && r.pay_period_year === payrollPeriod.year)
  ), [payrollRecords, payrollPeriod]);

  const periodPayrollRecords = payrollRecords.filter((r) => r.pay_period_month === payrollPeriod.month && r.pay_period_year === payrollPeriod.year);

  // Stats
  const today = new Date().toISOString().split("T")[0];
  const attendanceRate = computeAttendanceRate(attendance, today);
  const activeStaff = employees.filter((e) => e.employment_status === "active").length;
  const ghostWorkers = useMemo(() => detectGhostWorkers(employees, attendance), [employees, attendance]);
  const openAlerts = hrAlerts.filter((a) => a.status === "open");

  const screeningStats = {
    total: checks.length,
    cleared: checks.filter((c) => c.overall_status === "cleared").length,
    flagged: checks.filter((c) => c.overall_status === "flagged").length,
    rejected: checks.filter((c) => c.overall_status === "rejected").length,
  };

  const overviewStats = [
    { label: "Active Staff", value: activeStaff, icon: Users, color: "text-slate-700 bg-slate-100" },
    { label: "Today's Attendance", value: `${attendanceRate}%`, icon: CalendarClock, color: "text-teal-600 bg-teal-50" },
    { label: "HR Risk Alerts", value: openAlerts.length, icon: AlertTriangle, color: "text-red-600 bg-red-50" },
    { label: "Ghost Workers", value: ghostWorkers.length, icon: UserX, color: "text-orange-600 bg-orange-50" },
  ];

  const screeningStatCards = [
    { label: "Total Screened", value: screeningStats.total, icon: Users, color: "text-slate-700 bg-slate-100" },
    { label: "Cleared", value: screeningStats.cleared, icon: UserCheck, color: "text-emerald-600 bg-emerald-50" },
    { label: "Flagged", value: screeningStats.flagged, icon: AlertTriangle, color: "text-amber-600 bg-amber-50" },
    { label: "Rejected", value: screeningStats.rejected, icon: UserX, color: "text-red-600 bg-red-50" },
  ];

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-slate-200 px-4 md:px-8 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-violet-600" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-[#231F20]">HR Dashboard</h1>
            <p className="text-xs text-slate-500">Workforce Intelligence & Risk Suite</p>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <button
              onClick={() => exportBackgroundCheckAuditCSV(checks)}
              disabled={checks.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium hover:bg-slate-200 disabled:opacity-50"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> Screening Audit CSV
            </button>
            <button
              onClick={() => exportAttendanceSummaryPDF(attendance, "", profile)}
              disabled={attendance.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium hover:bg-slate-200 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" /> Attendance PDF
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mt-3 overflow-x-auto -mb-4 pb-px">
          {TABS.map((t) => {
            const TIcon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                  tab === t.key ? "border-violet-600 text-violet-700" : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                <TIcon className="w-3.5 h-3.5" /> {t.label}
                {t.key === "alerts" && openAlerts.length > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 text-[9px] font-bold">{openAlerts.length}</span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      <div className="p-4 md:p-8">
        {/* === OVERVIEW TAB === */}
        {tab === "overview" && (
          <div className="space-y-6">
            {/* Top-level metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {overviewStats.map((s) => {
                const SIcon = s.icon;
                return (
                  <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${s.color}`}>
                      <SIcon className="w-4 h-4" />
                    </div>
                    <p className="text-xl font-bold text-[#231F20] tabular-nums">{s.value}</p>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide">{s.label}</p>
                  </div>
                );
              })}
            </div>

            {/* Screening stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {screeningStatCards.map((s) => {
                const SIcon = s.icon;
                return (
                  <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${s.color}`}>
                      <SIcon className="w-4 h-4" />
                    </div>
                    <p className="text-xl font-bold text-[#231F20] tabular-nums">{s.value}</p>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide">{s.label}</p>
                  </div>
                );
              })}
            </div>

            {/* Data ingestion portals */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <EmployeeUploadZone onIngested={loadAll} user={user} />
              <AttendanceUploadZone onIngested={loadAll} employees={employees} />
            </div>

            {/* Recent alerts preview */}
            <div>
              <h3 className="text-sm font-semibold text-[#231F20] mb-3">Recent HR Risk Alerts</h3>
              <HRAlertsPanel alerts={openAlerts.slice(0, 5)} loading={loading} onDismiss={handleDismissAlert} />
            </div>
          </div>
        )}

        {/* === EMPLOYEE DIRECTORY TAB === */}
        {tab === "employees" && (
          <div className="space-y-6">
            <EmployeeUploadZone onIngested={loadAll} user={user} />
            <EmployeeDirectory employees={employees} loading={loading} />
          </div>
        )}

        {/* === ATTENDANCE TAB === */}
        {tab === "attendance" && (
          <div className="space-y-6">
            <AttendanceUploadZone onIngested={loadAll} employees={employees} />
            <AttendanceLogTable records={attendance} loading={loading} />
          </div>
        )}

        {/* === SCREENING TAB === */}
        {tab === "screening" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {screeningStatCards.map((s) => {
                  const SIcon = s.icon;
                  return (
                    <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${s.color}`}>
                        <SIcon className="w-4 h-4" />
                      </div>
                      <p className="text-xl font-bold text-[#231F20] tabular-nums">{s.value}</p>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wide">{s.label}</p>
                    </div>
                  );
                })}
              </div>

              {selectedCheck && selectedCheck.status === "completed" && (
                <BackgroundCheckResult check={selectedCheck} onConverted={loadAll} />
              )}

              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-[#231F20] mb-4">Screening History</h3>
                {loading ? (
                  <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-lg bg-slate-100 animate-pulse" />)}</div>
                ) : checks.length === 0 ? (
                  <div className="text-center py-8">
                    <FileSearch className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="text-sm text-slate-400">No background checks yet</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {checks.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setSelectedCheck(c)}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                          selectedCheck?.id === c.id ? "border-slate-900 bg-slate-50" : "border-slate-100 hover:bg-slate-50/60"
                        }`}
                      >
                        <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                          <Scan className="w-4 h-4 text-slate-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[#231F20] truncate">{c.candidate_name}</p>
                          <p className="text-xs text-slate-400">{c.position_applied || "—"} · {c.screening_date ? new Date(c.screening_date).toLocaleDateString() : "Pending"}</p>
                        </div>
                        {c.status === "completed" && <RiskBadge level={c.risk_level} size="sm" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-6">
              <BackgroundCheckForm user={user} onScreening={handleScreening} />
              {screening && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                  <div>
                    <p className="text-sm font-medium text-blue-900">Running background screening…</p>
                    <p className="text-xs text-blue-600">Checking identity, criminal records, employment, sanctions…</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* === PAYROLL TAB === */}
        {tab === "payroll" && (
          <div className="space-y-6">
            {/* Payroll controls */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-slate-500" />
                  <span className="text-sm font-semibold text-slate-700">Pay Period:</span>
                  <select
                    value={payrollPeriod.month}
                    onChange={(e) => setPayrollPeriod((p) => ({ ...p, month: e.target.value }))}
                    className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white"
                  >
                    {["January","February","March","April","May","June","July","August","September","October","November","December"].map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <select
                    value={payrollPeriod.year}
                    onChange={(e) => setPayrollPeriod((p) => ({ ...p, year: parseInt(e.target.value) }))}
                    className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white"
                  >
                    {[2024, 2025, 2026].map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <button
                  onClick={handleGeneratePayroll}
                  disabled={generatingPayroll || employees.length === 0}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
                >
                  {generatingPayroll ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
                  {generatingPayroll ? "Calculating…" : "Generate Payroll"}
                </button>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={() => exportBankDisbursementCSV(periodPayrollRecords, employees)}
                    disabled={periodPayrollRecords.length === 0}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium hover:bg-slate-200 disabled:opacity-50"
                  >
                    <Banknote className="w-3.5 h-3.5" /> Bank Disbursement
                  </button>
                  <button
                    onClick={() => exportPayrollAuditPDF(periodPayrollRecords, profile)}
                    disabled={periodPayrollRecords.length === 0}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium hover:bg-slate-200 disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" /> Audit PDF
                  </button>
                  <button
                    onClick={() => exportPayrollAuditCSV(periodPayrollRecords)}
                    disabled={periodPayrollRecords.length === 0}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium hover:bg-slate-200 disabled:opacity-50"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" /> Audit CSV
                  </button>
                </div>
              </div>
            </div>

            {/* Overview stats */}
            <PayrollOverviewPanel summary={payrollSummary} />

            {/* Config + Biometric upload */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <PayrollConfigPanel config={payrollConfig} onChange={setPayrollConfig} />
              <BiometricUploadZone onIngested={loadAll} employees={employees} user={user} />
            </div>

            {/* Payroll table */}
            <PayrollTable
              records={periodPayrollRecords}
              employees={employees}
              loading={loading}
              onApprove={handleApprovePayroll}
              onFlag={handleFlagPayroll}
            />
          </div>
        )}

        {/* === ALERTS TAB === */}
        {tab === "alerts" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Open Alerts", value: openAlerts.length, icon: Bell, color: "text-red-600 bg-red-50" },
                { label: "Attendance Anomalies", value: openAlerts.filter((a) => a.alert_type === "attendance_anomaly").length, icon: CalendarClock, color: "text-amber-600 bg-amber-50" },
                { label: "Ghost Workers", value: openAlerts.filter((a) => a.alert_type === "ghost_worker").length, icon: UserX, color: "text-orange-600 bg-orange-50" },
                { label: "Critical", value: openAlerts.filter((a) => a.severity === "critical").length, icon: AlertTriangle, color: "text-red-600 bg-red-50" },
              ].map((s) => {
                const SIcon = s.icon;
                return (
                  <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${s.color}`}>
                      <SIcon className="w-4 h-4" />
                    </div>
                    <p className="text-xl font-bold text-[#231F20] tabular-nums">{s.value}</p>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide">{s.label}</p>
                  </div>
                );
              })}
            </div>
            <HRAlertsPanel alerts={openAlerts} loading={loading} onDismiss={handleDismissAlert} />
          </div>
        )}
      </div>

      <BackToTop />
    </div>
  );
}