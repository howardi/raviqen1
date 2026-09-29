import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { FileText, Inbox, CheckCircle2, Flag, Filter } from "lucide-react";
import DailyReportForm from "@/components/reports/DailyReportForm";
import DailyReportCard from "@/components/reports/DailyReportCard";
import ReportCalendar from "@/components/calendar/ReportCalendar";
import BackToTop from "@/components/BackToTop";
import { CalendarDays, List } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { logActivity } from "@/lib/activityLogger";
import { normalizeUserRole, isAdminRole } from "@/lib/permissions";
import { sendDailyReportNotification } from "@/lib/companyNotifications";
import { stampTenant } from "@/lib/tenantScope";

const DEPT_LABELS = {
  restaurant: "Restaurant / F&B", operations: "Operations", front_desk: "Front Desk",
  hr: "Human Resources", finance: "Finance", general: "General",
};

export default function DailyReports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deptFilter, setDeptFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [viewMode, setViewMode] = useState("list");
  const [selectedDateReports, setSelectedDateReports] = useState(null);
  const { user } = useAuth();
  const role = normalizeUserRole(user);
  const canReview = isAdminRole(role) || role === "manager" || role === "executive";

  useEffect(() => { loadReports(); }, []);

  const loadReports = async () => {
    try {
      const data = await base44.entities.DailyReport.list("-created_date", 50);
      setReports(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (formData) => {
    const reportId = `RPT-${Date.now()}`;
    const newReport = await base44.entities.DailyReport.create(stampTenant({
      report_id: reportId,
      ...formData,
      submitted_by: user?.full_name || user?.email || "Unknown",
      submitted_by_id: user?.id || "",
      status: "submitted",
    }, user));
    await logActivity(user, "daily_report_submit", `Submitted daily report: ${formData.title}`, "DailyReport", newReport.id);
    // Notify admins/managers via email
    try {
      const allUsers = await base44.entities.User.list("-created_date", 50);
      const reviewers = allUsers.filter((u) => {
        const r = u.raviqen_role || u.role;
        return r === "super_admin" || r === "org_admin" || r === "manager" || r === "executive";
      });
      for (const rev of reviewers) {
        try {
          await base44.integrations.Core.SendEmail({
            to: rev.email,
            subject: `RAVIQEN: New Daily Report — ${formData.title}`,
            body: `Hello ${rev.full_name || rev.email},\n\nA new daily report has been submitted:\n\nTitle: ${formData.title}\nDepartment: ${DEPT_LABELS[formData.department] || formData.department}\nDate: ${formData.report_date}\nPriority: ${formData.priority}\nSubmitted by: ${user?.full_name || user?.email}\n\nLog in to RAVIQEN to review.\n\nRAVIQEN Risk & Compliance Intelligence`,
          });
        } catch (e) {}
      }
    } catch (e) {}
    // Also send to the company's dedicated notification email
    await sendDailyReportNotification(formData, user?.full_name || user?.email || "Unknown");
    await loadReports();
  };

  const handleMarkRead = async (report) => {
    const readBy = [...new Set([...(report.read_by || []), user?.id])];
    const newStatus = report.status === "submitted" ? "read" : report.status;
    await base44.entities.DailyReport.update(report.id, { read_by: readBy, status: newStatus });
    await loadReports();
  };

  const handleComment = async (report, text) => {
    const comments = [...(report.comments || []), {
      author: user?.full_name || user?.email || "Reviewer",
      text,
      timestamp: new Date().toLocaleString(),
    }];
    await base44.entities.DailyReport.update(report.id, { comments, status: "commented" });
    await logActivity(user, "daily_report_comment", `Commented on report: ${report.title}`, "DailyReport", report.id);
    await loadReports();
  };

  const handleFlag = async (report, reason) => {
    await base44.entities.DailyReport.update(report.id, { status: "flagged", flagged_reason: reason });
    await logActivity(user, "daily_report_flag", `Flagged report: ${report.title} — ${reason}`, "DailyReport", report.id);
    await loadReports();
  };

  const filtered = reports.filter((r) => {
    if (deptFilter && r.department !== deptFilter) return false;
    if (statusFilter && r.status !== statusFilter) return false;
    return true;
  });

  const stats = {
    total: reports.length,
    new: reports.filter((r) => r.status === "submitted").length,
    flagged: reports.filter((r) => r.status === "flagged").length,
    read: reports.filter((r) => r.status === "read" || r.status === "commented").length,
  };

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-slate-200 px-4 md:px-8 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-bold text-[#231F20]">Daily Reports</h1>
            <p className="text-xs text-slate-500">In-app daily operational report submission & review hub</p>
          </div>
          <div className="flex gap-1 p-1 bg-slate-50 rounded-lg border border-slate-100">
            <button onClick={() => setViewMode("list")} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === "list" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
              <List className="w-3.5 h-3.5" /> List
            </button>
            <button onClick={() => setViewMode("calendar")} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === "calendar" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
              <CalendarDays className="w-3.5 h-3.5" /> Calendar
            </button>
          </div>
        </div>
      </header>

      <div className="p-4 md:p-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {viewMode === "calendar" ? (
            <>
              <ReportCalendar
                reports={filtered}
                selectedDate={selectedDateReports?.date}
                onSelectDate={(dateKey, dayReports) => setSelectedDateReports(dayReports.length > 0 ? { date: dateKey, reports: dayReports } : null)}
              />
              {selectedDateReports && (
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-[#231F20]">Reports on {selectedDateReports.date}</h3>
                    <button onClick={() => setSelectedDateReports(null)} className="text-xs text-slate-400 hover:text-slate-600">Clear</button>
                  </div>
                  {/* Department breakdown */}
                  {(() => {
                    const deptMap = {};
                    selectedDateReports.reports.forEach((r) => {
                      const d = r.department || "general";
                      if (!deptMap[d]) deptMap[d] = 0;
                      deptMap[d]++;
                    });
                    const deptColors = {
                      restaurant: "bg-orange-100 text-orange-700 border-orange-200",
                      operations: "bg-blue-100 text-blue-700 border-blue-200",
                      front_desk: "bg-cyan-100 text-cyan-700 border-cyan-200",
                      hr: "bg-violet-100 text-violet-700 border-violet-200",
                      finance: "bg-emerald-100 text-emerald-700 border-emerald-200",
                      general: "bg-slate-100 text-slate-700 border-slate-200",
                    };
                    return (
                      <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b border-slate-100">
                        {Object.entries(deptMap).map(([dept, count]) => (
                          <span key={dept} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${deptColors[dept] || deptColors.general}`}>
                            {DEPT_LABELS[dept] || dept}
                            <span className="font-bold tabular-nums">{count}</span>
                          </span>
                        ))}
                      </div>
                    );
                  })()}
                  <div className="space-y-3">
                    {selectedDateReports.reports.map((r) => (
                      <DailyReportCard key={r.id} report={r} user={user} onMarkRead={handleMarkRead} onComment={handleComment} onFlag={handleFlag} />
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
          <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Total Reports", value: stats.total, icon: FileText, color: "text-slate-700 bg-slate-100" },
              { label: "New", value: stats.new, icon: Inbox, color: "text-blue-600 bg-blue-50" },
              { label: "Reviewed", value: stats.read, icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50" },
              { label: "Flagged", value: stats.flagged, icon: Flag, color: "text-red-600 bg-red-50" },
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

          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <Filter className="w-4 h-4 text-slate-400" />
            <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="text-sm px-3 py-1.5 rounded-lg border border-slate-200 outline-none bg-white">
              <option value="">All Departments</option>
              {Object.entries(DEPT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="text-sm px-3 py-1.5 rounded-lg border border-slate-200 outline-none bg-white">
              <option value="">All Statuses</option>
              <option value="submitted">New</option>
              <option value="read">Read</option>
              <option value="commented">Commented</option>
              <option value="flagged">Flagged</option>
              <option value="archived">Archived</option>
            </select>
            {(deptFilter || statusFilter) && (
              <button onClick={() => { setDeptFilter(""); setStatusFilter(""); }} className="text-xs text-slate-500 hover:text-slate-900">Clear</button>
            )}
          </div>

          {/* Report feed */}
          {loading ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-xl bg-slate-100 animate-pulse" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
              <FileText className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p className="text-sm text-slate-400">No daily reports submitted yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((r) => (
                <DailyReportCard key={r.id} report={r} user={user} onMarkRead={handleMarkRead} onComment={handleComment} onFlag={handleFlag} />
              ))}
            </div>
          )}
          </>
          )}
        </div>

        {/* Sidebar: submission form */}
        <div className="space-y-6">
          <DailyReportForm user={user} onSubmit={handleSubmit} />
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500">
              {canReview
                ? "You have review access — you can mark reports as read, add comments, and flag items for follow-up."
                : "Submit your daily operational reports here. Management will be notified automatically."}
            </p>
          </div>
        </div>
      </div>

      <BackToTop />
    </div>
  );
}