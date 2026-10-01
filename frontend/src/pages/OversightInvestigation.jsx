import React, { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { jsPDF } from "jspdf";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { normalizeUserRole } from "@/lib/permissions";
import { BRAND_PROMISE, DEFAULT_OVERSIGHT_DEPARTMENTS, isOversightManagerRole } from "@/lib/oversight";
import { RISK_CATEGORIES, mandateFromFinding } from "@/lib/riskMandate";
import { buildInvestigationReport } from "@/lib/reportFraud";
import OversightAnalysis from "@/components/oversight/OversightAnalysis";

function downloadReport(doc) {
  const pdf = new jsPDF();
  const lines = pdf.splitTextToSize([
    doc.title,
    "",
    doc.executive_summary,
    "",
    "Department coverage",
    ...doc.departments.map((d) => `${d.nav_label}: ${d.count} reports, ${d.flagged} flagged`),
    "",
    "Fraud findings",
    ...(doc.findings.length ? doc.findings.map((f) => `${f.severity.toUpperCase()} · ${f.department} · ${f.title} — ${f.evidence} Action: ${f.action}`) : ["None"]),
    "",
    "Open issues",
    ...(doc.issues.length ? doc.issues.map((i) => `${i.status} · ${i.title} · ${i.owner}`) : ["None"]),
    "",
    doc.conclusion,
    "",
    "Turn business data into clearer visibility, stronger controls, and smarter decisions.",
  ].join("\n"), 180);
  let y = 16;
  lines.forEach((line) => {
    if (y > 280) { pdf.addPage(); y = 16; }
    pdf.text(line, 14, y);
    y += 6;
  });
  pdf.save("raviqen-investigation-report.pdf");
}

export default function OversightInvestigation() {
  const { user } = useAuth();
  const [issues, setIssues] = useState([]);
  const [reports, setReports] = useState([]);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [owner, setOwner] = useState("");
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [filedId, setFiledId] = useState("");
  const allowed = isOversightManagerRole(normalizeUserRole(user));

  const load = async () => {
    const [i, r] = await Promise.all([
      base44.entities.RavenIssue.filter({ tenant_id: user.tenant_id }, "-created_date", 200),
      base44.entities.DailyReport.filter({ tenant_id: user.tenant_id }, "-created_date", 200),
    ]);
    setIssues(i.filter((row) => row.tenant_id === user.tenant_id));
    setReports(r.filter((row) => row.tenant_id === user.tenant_id));
  };

  useEffect(() => {
    if (allowed && user?.tenant_id) load().catch((e) => setError(e.message));
  }, [allowed, user?.tenant_id]);

  const document = useMemo(() => buildInvestigationReport({
    departments: DEFAULT_OVERSIGHT_DEPARTMENTS,
    reports,
    issues,
    generatedBy: user?.full_name || user?.email || "Manager",
  }), [reports, issues, user?.full_name, user?.email]);

  const add = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await base44.entities.RavenIssue.create({
        tenant_id: user.tenant_id,
        title: title.trim(),
        notes: notes.trim(),
        status: "open",
        owner: owner.trim(),
        due_date: due || undefined,
        created_by_id_ref: user.id,
      });
      setTitle("");
      setNotes("");
      setOwner("");
      setDue("");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (issue, status) => {
    setBusy(true);
    setError("");
    try {
      await base44.entities.RavenIssue.update(issue.id, { status });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const fileInvestigation = async () => {
    setBusy(true);
    setError("");
    try {
      const risk = document.findings.some((f) => f.severity === "critical") ? "critical"
        : document.findings.some((f) => f.severity === "high") ? "high"
        : document.findings.some((f) => f.severity === "medium") ? "medium" : "low";
      const created = await base44.entities.Investigation.create({
        tenant_id: user.tenant_id,
        title: document.title,
        vendor: "Daily operations",
        status: "open",
        outcome: "pending",
        risk_level: risk,
        ai_explanation: document.executive_summary,
        ai_confidence: document.findings.length ? "medium" : "high",
        evidence_summary: document.findings.map((f) => `${f.department}: ${f.title}. ${f.evidence}`).join("\n") || document.executive_summary,
        cited_signals: document.findings.map((f) => f.title).slice(0, 12),
        notes: document.conclusion,
        investigator: user.full_name || user.email || "Manager",
        recommended_actions: document.findings.map((f) => ({ action: f.action, priority: f.severity })),
      });
      setFiledId(created.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!allowed) return <Navigate to="/dashboard" replace />;

  return (
    <div className="space-y-6 p-4 md:p-8">
      <header>
        <p className="text-xs uppercase tracking-wide text-slate-500">Raviqen · Manager only</p>
        <h1 className="text-2xl font-bold text-slate-900">Overall Business Investigation</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">{BRAND_PROMISE}</p>
      </header>
      {!user?.tenant_id ? (
        <p role="alert">Assign your organization to use this workspace.</p>
      ) : (
        <>
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-bold text-slate-900">Investigation report</h2>
                <p className="mt-2 max-w-3xl text-sm text-slate-700">{document.executive_summary}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => downloadReport(document)} className="rounded-lg border px-3 py-2 text-xs font-medium">Download PDF</button>
                <button type="button" disabled={busy} onClick={fileInvestigation} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-50">File in Investigations</button>
              </div>
            </div>
            {filedId && <p className="mt-3 text-sm"><Link className="font-medium text-blue-700 underline" to={`/investigations/${filedId}`}>Open the filed investigation</Link></p>}
            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {document.departments.map((dept) => (
                <div key={dept.slug} className="rounded-lg border border-slate-100 p-3 text-sm">
                  <p className="font-semibold">{dept.nav_label}</p>
                  <p className="text-xs text-slate-500">{dept.count} reports · {dept.flagged} flagged</p>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-2">
              {document.findings.map((f, index) => (
                <article key={`${f.report_id}-${index}`} className="rounded-lg bg-slate-50 p-3 text-sm">
                  <p className="font-semibold capitalize">{f.severity} · {f.department} · {f.title}</p>
                  <p className="mt-1 text-slate-600">{f.evidence}</p>
                  <p className="mt-1 text-xs text-slate-500">Action: {f.action}</p>
                </article>
              ))}
              {!document.findings.length && <p className="text-sm text-slate-500">No fraud findings in the current submissions.</p>}
            </div>
            <p className="mt-4 text-sm text-slate-700">{document.conclusion}</p>
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-bold">Discrepancy matrix</h2>
            <p className="mt-1 text-xs text-slate-500">Each row is taken from a submitted report. Nothing is added beyond the recorded figures.</p>
            <div className="mt-4 space-y-4">
              {RISK_CATEGORIES.map((category) => {
                const rows = document.findings.filter((item) => mandateFromFinding(item).category === category.label);
                return (
                  <div key={category.id}>
                    <h3 className="text-sm font-semibold text-slate-800">{category.label}</h3>
                    {rows.length ? rows.map((item, index) => {
                      const mandate = mandateFromFinding(item, item.department);
                      return (
                        <article key={`${item.report_id}-${index}`} className="mt-2 rounded-lg bg-slate-50 p-3 text-sm">
                          <p><span className="font-semibold">What requires attention. </span>{mandate.attention}</p>
                          <p className="mt-1"><span className="font-semibold">Where it matters. </span>{mandate.where}</p>
                          <p className="mt-1"><span className="font-semibold">When to act. </span>{mandate.when}</p>
                        </article>
                      );
                    }) : <p className="mt-1 text-sm text-slate-500">None in the current submissions.</p>}
                  </div>
                );
              })}
            </div>
          </section>
          <OversightAnalysis label="Cross-department" />
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-bold">Meeting issues & action items</h2>
            <form onSubmit={add} className="mt-4 grid gap-2">
              <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Issue to investigate" className="rounded-lg border p-2 text-sm" />
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Evidence, meeting notes, next steps" className="rounded-lg border p-2 text-sm" />
              <div className="grid gap-2 sm:grid-cols-2">
                <input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Owner" className="rounded-lg border p-2 text-sm" />
                <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="rounded-lg border p-2 text-sm" />
              </div>
              <button disabled={busy || !title.trim()} className="w-fit rounded-lg bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50">Add issue</button>
            </form>
            {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
            <div className="mt-5 space-y-2">
              {issues.map((i) => (
                <article key={i.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap justify-between gap-2">
                    <strong className="text-sm">{i.title}</strong>
                    <div className="flex gap-2">
                      <button type="button" disabled={busy} onClick={() => setStatus(i, "investigated")} className={`rounded px-2 py-1 text-xs ${i.status === "investigated" ? "bg-slate-900 text-white" : "border"}`}>Investigated</button>
                      <button type="button" disabled={busy} onClick={() => setStatus(i, "resolved")} className={`rounded px-2 py-1 text-xs ${i.status === "resolved" ? "bg-emerald-700 text-white" : "border"}`}>Resolved</button>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{i.owner || "Unassigned"}{i.due_date ? ` · ${i.due_date}` : ""}</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{i.notes}</p>
                </article>
              ))}
              {!issues.length && <p className="text-sm text-slate-500">No issues logged yet.</p>}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
