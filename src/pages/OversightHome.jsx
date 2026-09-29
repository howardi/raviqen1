import React, { useCallback, useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { normalizeUserRole } from "@/lib/permissions";
import { DEFAULT_OVERSIGHT_DEPARTMENTS, OVERSIGHT_HERO, isOversightFeatureEnabled, isOversightManagerRole, sortOversightDepartments } from "@/lib/oversight";
import OversightInbox from "@/components/oversight/OversightInbox";
import OversightReportList from "@/components/oversight/OversightReportList";
import OversightAnalysis from "@/components/oversight/OversightAnalysis";

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

  return (
    <div className="min-h-screen space-y-6 p-4 md:p-8">
      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Raviqen · Management oversight</p>
        <h1 className="mt-2 max-w-4xl text-2xl font-bold leading-tight text-slate-900 md:text-3xl">{OVERSIGHT_HERO}</h1>
      </header>
      {!user?.tenant_id ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">Assign your organization in User Management before opening reports.</p>
      ) : loading ? (
        <p role="status">Loading your report inbox…</p>
      ) : (
        <>
          {error && <p role="alert" className="text-red-700">{error}</p>}
          <OversightInbox reports={reports} users={users} viewerId={user.id} departments={departments} />
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
