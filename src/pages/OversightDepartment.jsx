import React, { useEffect, useMemo, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { jsPDF } from "jspdf";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { normalizeUserRole } from "@/lib/permissions";
import { DEFAULT_OVERSIGHT_DEPARTMENTS, isOversightManagerRole, weeklyPurchaseSummary } from "@/lib/oversight";
import OversightDepartmentNav from "@/components/oversight/OversightDepartmentNav";
import OversightReportList from "@/components/oversight/OversightReportList";
import OversightAnalysis from "@/components/oversight/OversightAnalysis";

export default function OversightDepartment() {
  const { department } = useParams();
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [ingested, setIngested] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const dept = DEFAULT_OVERSIGHT_DEPARTMENTS.find((x) => x.slug === department) || { slug: department, name: department, nav_label: department };
  const allowed = isOversightManagerRole(normalizeUserRole(user));

  const load = async () => {
    const [r, i, p] = await Promise.all([
      base44.entities.DailyReport.filter({ tenant_id: user.tenant_id, department }, "-created_date", 200),
      base44.entities.RavenIngestion.filter({ tenant_id: user.tenant_id, department }, "-created_date", 200),
      base44.entities.OversightPurchaseLine.filter({ tenant_id: user.tenant_id, department }, "-created_date", 200).catch(() => []),
    ]);
    setReports(r.filter((row) => row.tenant_id === user.tenant_id && row.department === department));
    setIngested(i.filter((row) => row.tenant_id === user.tenant_id && row.department === department));
    setPurchases(p.filter((row) => row.tenant_id === user.tenant_id));
  };

  useEffect(() => {
    if (allowed && user?.tenant_id && department) load().catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [department, user?.tenant_id, allowed]);

  const numeric = useMemo(
    () => ingested.flatMap((r) => Object.entries(r.metrics || {}).filter(([, v]) => v !== "" && Number.isFinite(Number(v))).map(([key, value]) => ({ date: r.report_date, key, value: Number(value) }))),
    [ingested]
  );
  const week = weeklyPurchaseSummary(purchases);

  const exportCsv = () => {
    const lines = [["Report ID", "Date", "Metric", "Value"], ...numeric.map((x) => ["", x.date, x.key, x.value])];
    const csv = lines.map((row) => row.map((x) => `"${String(x ?? "").replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `raviqen-${department}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = () => {
    const doc = new jsPDF();
    doc.text(`Raviqen · ${dept.nav_label || dept.name}`, 14, 16);
    ingested.slice(0, 20).forEach((row, index) => {
      doc.text(`${row.report_date} ${row.title}`.slice(0, 80), 14, 28 + index * 8);
    });
    doc.save(`raviqen-${department}.pdf`);
  };

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

  if (!allowed) return <Navigate to="/oversight" replace />;

  return (
    <div className="space-y-6 p-4 md:p-8">
      <header>
        <p className="text-xs uppercase tracking-wide text-slate-500">Raviqen · Department oversight</p>
        <h1 className="text-2xl font-bold text-slate-900">{dept.nav_label || dept.name}</h1>
      </header>
      <OversightDepartmentNav />
      {!user?.tenant_id ? (
        <p role="alert" className="text-amber-700">Assign your organization before reviewing reports.</p>
      ) : loading ? (
        <p role="status">Loading department reports…</p>
      ) : (
        <>
          {error && <p role="alert" className="text-red-700">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button onClick={exportCsv} disabled={!numeric.length} className="rounded-lg border px-3 py-2 text-xs disabled:opacity-50">Export CSV</button>
            <button onClick={exportPdf} className="rounded-lg border px-3 py-2 text-xs">Export PDF</button>
          </div>
          {numeric.length > 0 && (
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="font-bold">Ingested metrics</h2>
              <div className="mt-4 space-y-2">
                {numeric.slice(0, 12).map((m, i) => (
                  <div key={`${m.date}-${m.key}-${i}`} className="flex items-center gap-2 text-xs">
                    <span className="w-28 shrink-0 truncate capitalize">{m.key.replaceAll("_", " ")}</span>
                    <div className="h-2 flex-1 rounded bg-slate-100">
                      <div className="h-2 rounded bg-slate-700" style={{ width: `${Math.max(0, Math.min(100, Math.abs(m.value) / Math.max(1, ...numeric.filter((x) => x.key === m.key).map((x) => Math.abs(x.value))) * 100))}%` }} />
                    </div>
                    <span className="w-20 text-right tabular-nums">{m.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
          {dept.purchases && (
            <section className="rounded-xl border border-slate-200 bg-white p-5 text-sm">
              <h2 className="font-bold">Weekly purchases summary</h2>
              <p className="mt-2 text-slate-600">{week.start} – {week.end}: {week.lines} lines · {week.total.toLocaleString()}</p>
            </section>
          )}
          <OversightAnalysis department={department} label={dept.nav_label || dept.name} />
          <OversightReportList reports={reports} onAction={onAction} busy={busy} />
        </>
      )}
    </div>
  );
}
