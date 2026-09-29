import React, { useState } from "react";
import { analyzeReportFraud } from "@/lib/reportFraud";
import { DEFAULT_OVERSIGHT_DEPARTMENTS } from "@/lib/oversight";

const RISK = {
  low: "bg-emerald-50 text-emerald-700",
  medium: "bg-amber-50 text-amber-800",
  high: "bg-orange-50 text-orange-800",
  critical: "bg-red-50 text-red-700",
};

export default function OversightReportList({ reports, onAction, busy }) {
  const [open, setOpen] = useState("");
  const [reason, setReason] = useState("");
  return (
    <section className="space-y-3">
      <h2 className="text-base font-bold text-slate-900">Submitted reports</h2>
      {!reports.length && <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">No reports submitted yet.</p>}
      {reports.map((r) => {
        const analysis = r.fraud_analysis?.findings?.length
          ? r.fraud_analysis
          : analyzeReportFraud({ report: r, history: reports, purchases: r.purchases || [] });
        const department = DEFAULT_OVERSIGHT_DEPARTMENTS.find((d) => d.slug === r.department)?.name || r.department;
        return (
        <article key={r.id} className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-slate-900">{r.title}</h3>
              <p className="text-xs text-slate-500">{department} · {r.submitted_by} · {r.report_date} · {new Date(r.created_date).toLocaleString()}</p>
              {r.corrects_report_id && <p className="text-xs text-amber-700">Correction of {r.corrects_report_id}</p>}
            </div>
            <div className="flex gap-2">
              <span className={`rounded-full px-2 py-1 text-xs font-semibold capitalize ${RISK[analysis.risk_level] || RISK.low}`}>{analysis.risk_level} fraud risk</span>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs capitalize">{r.ingestion_status || "submitted"}</span>
            </div>
          </div>
          <button type="button" onClick={() => { if (open !== r.id) onAction(r, "review"); setOpen(open === r.id ? "" : r.id); }} className="mt-3 text-sm font-medium text-blue-700">
            {open === r.id ? "Close" : "Open report"}
          </button>
          {open === r.id && (
            <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
              <p className="whitespace-pre-wrap text-sm text-slate-700">{r.content}</p>
              <dl className="grid gap-2 sm:grid-cols-3">
                {Object.entries(r.metrics || {}).map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-slate-50 p-3">
                    <dt className="text-xs capitalize text-slate-500">{k.replaceAll("_", " ")}</dt>
                    <dd className="font-semibold text-slate-800">{String(v)}</dd>
                  </div>
                ))}
              </dl>
              <section className="rounded-lg border border-slate-200 p-4">
                <h3 className="text-sm font-bold text-slate-900">Fraud detection analysis</h3>
                <p className="mt-1 text-xs text-slate-500">Score {analysis.score} · manager only · checked when the report was submitted</p>
                <ul className="mt-3 space-y-2">
                  {analysis.findings.map((item) => (
                    <li key={item.code} className="rounded-lg bg-slate-50 p-3 text-sm">
                      <p className="font-semibold text-slate-900">{item.title}</p>
                      <p className="mt-1 text-slate-600">{item.evidence}</p>
                      <p className="mt-1 text-xs text-slate-500">Action: {item.action}</p>
                    </li>
                  ))}
                </ul>
              </section>
              {(r.file_urls || []).concat(r.file_url || []).filter(Boolean).map((url) => (
                <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="block text-sm text-blue-700 underline">View attachment</a>
              ))}
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={r.ingestion_status === "ingested" || busy === r.id} onClick={() => onAction(r, "ingest")} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                  {r.ingestion_status === "ingested" ? "Ingested" : "Ingest Data"}
                </button>
              </div>
              {r.ingestion_status !== "ingested" && (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input value={open === r.id ? reason : ""} onChange={(e) => setReason(e.target.value)} placeholder="Rejection reason" className="flex-1 rounded-lg border p-2 text-sm" />
                  <button type="button" disabled={busy === r.id || !reason.trim()} onClick={() => onAction(r, "reject", reason)} className="rounded-lg border border-red-200 px-4 py-2 text-sm text-red-700">Reject</button>
                </div>
              )}
              {r.rejection_reason && <p className="text-sm text-red-700">Rejected: {r.rejection_reason}</p>}
            </div>
          )}
        </article>
        );
      })}
    </section>
  );
}
