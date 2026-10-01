import React, { useCallback, useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { normalizeUserRole } from "@/lib/permissions";
import { BRAND_PROMISE, DEFAULT_OVERSIGHT_DEPARTMENTS, OVERSIGHT_HERO, isOversightFeatureEnabled, isOversightManagerRole, sortOversightDepartments } from "@/lib/oversight";
import OversightInbox from "@/components/oversight/OversightInbox";
import OversightReportList from "@/components/oversight/OversightReportList";
import OversightAnalysis from "@/components/oversight/OversightAnalysis";
import CommandCenterStaff from "@/components/oversight/CommandCenterStaff";

export default function OversightHome() {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState(DEFAULT_OVERSIGHT_DEPARTMENTS);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const allowed = isOversightManagerRole(normalizeUserRole(user)) && isOversightFeatureEnabled(user);

  const load = useCallback(async () => {
    const seeded = await base44.functions.invoke("seedOversightDepartments", {});
    setDepartments(sortOversightDepartments(seeded.departments || DEFAULT_OVERSIGHT_DEPARTMENTS));
    const [r, u] = await Promise.all([
      base44.entities.DailyReport.filter({ tenant_id: user.tenant_id }, "-created_date", 200),
      base44.entities.User.list("-created_date", 200).catch(() => []),
    ]);
    setReports(r.filter((row) => row.tenant_id === user.tenant_id));
    setUsers(u.filter((x) => x.tenant_id === user.tenant_id));
  }, [user?.tenant_id]);

  useEffect(() => {
    if (!allowed || !user?.tenant_id) {
      setLoading(false);
      return;
    }
    load().catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [allowed, user?.tenant_id, load]);

  const onAction = async (report, action, reason) => {
    setBusy(report.id);
    setError("");
    try {
      await base44.functions.invoke("ingestOversightReport", { report_id: report.id, action, reason });
      await load();
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setBusy("");
    }
  };

  if (!allowed) return <Navigate to="/dashboard" replace />;

  const unread = reports.filter((row) => !row.read_by?.includes(user.id)).length;
  const recent = [...reports].sort((a, b) => String(b.created_date || "").localeCompare(String(a.created_date || ""))).slice(0, 12);
  const varianceAlerts = reports.filter((row) => {
    const findings = row.fraud_analysis?.findings || row.fraud_findings || [];
    return findings.some((finding) => /price|procurement|variance|receipt/i.test(`${finding.code || ""} ${finding.title || ""} ${finding.type || ""}`));
  }).slice(0, 6);

  return (
    <div className="min-h-screen space-y-6 p-4 md:p-8">
      <header>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Super Admin Command Center</p>
          {unread > 0 && <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[11px] font-semibold text-white">{unread} new</span>}
        </div>
        <h1 className="mt-2 max-w-4xl text-2xl font-bold leading-tight text-slate-900 md:text-3xl">{OVERSIGHT_HERO}</h1>
        <p className="mt-3 text-sm font-medium text-emerald-700">{BRAND_PROMISE}</p>
      </header>
      {!user?.tenant_id ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">Assign your organization in User Management before opening reports.</p>
      ) : loading ? (
        <p role="status">Loading your report inbox…</p>
      ) : (
        <>
          {error && <p role="alert" className="text-red-700">{error}</p>}
          <OversightInbox reports={reports} users={users} viewerId={user.id} departments={departments} />
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-bold text-slate-900">Procurement variance alerts</h2>
              <Link to="/procurement-variance" className="text-xs font-semibold text-slate-700 underline">Open price checks</Link>
            </div>
            <div className="mt-3 space-y-2">
              {varianceAlerts.map((row) => (
                <p key={row.id} className="text-sm text-slate-700">{row.report_date} · {row.department} · {row.title || "Purchase report"}</p>
              ))}
              {!varianceAlerts.length && <p className="text-sm text-slate-500">No procurement price or receipt alerts in the current reports.</p>}
            </div>
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-base font-bold text-slate-900">Recent submissions</h2>
            <div className="mt-3 space-y-2">
              {recent.map((row) => (
                <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="text-slate-800">{row.department} · {row.title || "Daily report"}</span>
                  <span className="text-xs text-slate-500">{row.created_date ? new Date(row.created_date).toLocaleString() : row.report_date}</span>
                </div>
              ))}
              {!recent.length && <p className="text-sm text-slate-500">No submissions yet.</p>}
            </div>
          </section>
          <CommandCenterStaff users={users} tenantId={user.tenant_id} actorId={user.id} onChanged={load} />
          <OversightReportList reports={reports} onAction={onAction} busy={busy} />
          <OversightAnalysis label="All departments" />
          <p className="text-sm">
            <Link to="/oversight/investigation" className="font-semibold text-slate-800 underline">Open Overall Business Investigation</Link>
          </p>
        </>
      )}
    </div>
  );
}
