import React from 'react';
import { Link } from 'react-router-dom';
import { RAVEN_DEPARTMENTS } from '@/components/raven/departments';

export default function RavenInbox({ reports, users, viewerId }) {
  const today = new Date().toLocaleDateString('en-CA');
  return <section className="rounded-xl border border-slate-200 bg-white p-5">
    <h2 className="text-base font-bold text-slate-900">Raviqen Inbox</h2>
    <p className="mb-4 text-xs text-slate-500">Today's submissions by department · updates appear in the app</p>
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{RAVEN_DEPARTMENTS.map(d => {
      const rows = reports.filter(r => r.department === d.id && r.report_date === today);
      const latest = rows[0];
      const expected = users.filter(u => u.department === d.id && u.account_status !== 'disabled').length;
      const state = latest ? 'Submitted' : new Date().getHours() >= 18 ? 'Overdue' : 'Pending';
      const unread = rows.filter(r => !r.read_by?.includes(viewerId)).length;
      return <Link key={d.id} to={`/oversight/${d.id}`} className="rounded-lg border border-slate-200 p-4 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500">
        <div className="flex items-start justify-between gap-2"><strong className="text-sm text-slate-800">{d.label.replace(' Dashboard', '')}</strong><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${latest ? 'bg-emerald-50 text-emerald-700' : state === 'Overdue' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{state}</span></div>
        <p className="mt-2 text-xs text-slate-500">{latest ? new Date(latest.created_date).toLocaleString() : expected ? `${expected} assigned · awaiting reports` : 'No submitters assigned'}</p>
        {unread > 0 && <span className="mt-2 inline-block text-xs font-semibold text-blue-700">● {unread} unread {unread === 1 ? 'report' : 'reports'}</span>}
      </Link>;
    })}</div>
  </section>;
}