import React from "react";
import { inboxStatus } from "@/lib/oversight";

export default function OversightInbox({ reports, users, viewerId, departments }) {
  const today = new Date().toLocaleDateString("en-CA");
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-base font-bold text-slate-900">Raviqen Inbox</h2>
      <p className="mb-4 text-xs text-slate-500">Every department · submitted, pending, or overdue against that department's cut-off</p>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {departments.map((d) => {
          const rows = reports.filter((r) => r.department === d.slug && r.report_date === today);
          const latest = rows[0];
          const expected = users.filter((u) => u.department === d.slug && u.account_status !== "disabled").length;
          const state = inboxStatus({ latest, cutoffTime: d.cutoff_time });
          const unread = rows.filter((r) => !r.read_by?.includes(viewerId)).length;
          return (
            <article key={d.slug} className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-2">
                <strong className="text-sm text-slate-800">{d.name || d.nav_label}</strong>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${latest ? "bg-emerald-50 text-emerald-700" : state === "Overdue" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>{state}</span>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {latest ? new Date(latest.created_date).toLocaleString() : expected ? `${expected} assigned · awaiting reports` : "No submitters assigned"}
              </p>
              {unread > 0 && <span className="mt-2 inline-block text-xs font-semibold text-blue-700">● {unread} unread</span>}
              {rows.some((r) => r.corrects_report_id) && <p className="mt-1 text-[11px] text-amber-700">Includes a correction</p>}
            </article>
          );
        })}
      </div>
    </section>
  );
}
