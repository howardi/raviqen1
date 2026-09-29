import React, { useState } from 'react';

export default function RavenReportList({ reports, ingestedIds, onIngest, onOpen, busy }) {
  const [open, setOpen] = useState('');
  return <section className="space-y-3"><h2 className="text-base font-bold text-slate-900">Submitted reports</h2>
    {!reports.length && <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">No reports submitted for this department yet.</p>}
    {reports.map(r => <article key={r.id} className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold text-slate-900">{r.title}</h3><p className="text-xs text-slate-500">{r.submitted_by} · {r.report_date} · {new Date(r.created_date).toLocaleString()}</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-xs">{ingestedIds.has(r.id) ? 'Ingested' : 'Awaiting review'}</span></div>
      <button type="button" onClick={() => { if (open !== r.id) onOpen(r); setOpen(open === r.id ? '' : r.id); }} className="mt-3 text-sm font-medium text-blue-700">{open === r.id ? 'Close' : 'Open report'}</button>
      {open === r.id && <div className="mt-4 space-y-3 border-t border-slate-100 pt-4"><p className="whitespace-pre-wrap text-sm text-slate-700">{r.content}</p><dl className="grid gap-2 sm:grid-cols-3">{Object.entries(r.metrics || {}).map(([k,v]) => <div key={k} className="rounded-lg bg-slate-50 p-3"><dt className="text-xs capitalize text-slate-500">{k.replaceAll('_',' ')}</dt><dd className="font-semibold text-slate-800">{String(v)}</dd></div>)}</dl>{r.file_url && <a href={r.file_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-700 underline">View attachment</a>}
        <button type="button" disabled={ingestedIds.has(r.id) || busy === r.id} onClick={() => onIngest(r)} className="block rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{busy === r.id ? 'Ingesting…' : ingestedIds.has(r.id) ? 'Already ingested' : 'Approve & ingest data'}</button>
      </div>}
    </article>)}
  </section>;
}