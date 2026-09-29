import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';

export default function RavenAnalysis({ rows, label }) {
  const [insights, setInsights] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const numeric = rows.flatMap(r => Object.entries(r.metrics || {}).filter(([,v]) => v !== '' && Number.isFinite(Number(v))).map(([key,value]) => ({ report: r.source_report_id, date: r.report_date, key, value: Number(value) })));
  const exportCsv = () => {
    const lines = [['Report ID','Date','Metric','Value'],...numeric.map(x => [x.report,x.date,x.key,x.value])];
    const csv = lines.map(row => row.map(x => `"${String(x ?? '').replaceAll('"','""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `raven-${label.toLowerCase().replaceAll(' ','-')}.csv`; anchor.click(); URL.revokeObjectURL(url);
  };
  const analyze = async () => {
    setBusy(true); setError('');
    try {
      const allowed = rows.slice(0, 30).map(r => ({ id: r.source_report_id, department: r.department, date: r.report_date, metrics: r.metrics, notes: r.content.slice(0, 700) }));
      const res = await base44.integrations.Core.InvokeLLM({ prompt: `Identify trends, variances, inconsistencies and follow-up questions from ONLY these manager-approved records. Do not infer missing amounts, budgets, prices or facts. Each finding MUST cite one input id. No clearance decisions. Data: ${JSON.stringify(allowed)}`, response_json_schema: {type:'object',properties:{findings:{type:'array',items:{type:'object',properties:{source_id:{type:'string'},observation:{type:'string'},follow_up:{type:'string'}}}}}} });
      const ids = new Set(allowed.map(x => x.id));
      setInsights((res.findings || []).filter(f => ids.has(f.source_id) && f.observation).slice(0, 8));
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  return <section className="rounded-xl border border-slate-200 bg-white p-5"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-bold text-slate-900">{label} analysis</h2><p className="text-xs text-slate-500">Only manager-approved records · review AI findings against their sources</p></div><div className="flex gap-2"><button onClick={exportCsv} disabled={!numeric.length} className="rounded-lg border px-3 py-2 text-xs disabled:opacity-50">Export CSV</button><button onClick={analyze} disabled={!rows.length || busy} className="rounded-lg bg-slate-900 px-3 py-2 text-xs text-white disabled:opacity-50">{busy ? 'Analyzing…' : 'Run AI analysis'}</button></div></div>
    {!rows.length ? <p className="mt-4 text-sm text-slate-500">Approve a report to enable analysis.</p> : <div className="mt-4 space-y-2">{numeric.slice(0, 12).map((m,i) => <div key={`${m.report}-${m.key}-${i}`} className="flex items-center gap-2 text-xs"><span className="w-24 shrink-0 truncate capitalize">{m.key.replaceAll('_',' ')}</span><div className="h-2 flex-1 rounded bg-slate-100"><div className="h-2 rounded bg-slate-700" style={{width:`${Math.max(0, Math.min(100, Math.abs(m.value) / Math.max(1,...numeric.filter(x => x.key === m.key).map(x => Math.abs(x.value))) * 100))}%`}} /></div><span className="w-20 text-right tabular-nums">{m.value.toLocaleString()}</span></div>)}</div>}
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}{insights.length > 0 && <div className="mt-5 space-y-2"><h3 className="text-sm font-semibold">Source-linked findings</h3>{insights.map((f,i) => <div key={i} className="rounded-lg bg-slate-50 p-3 text-sm"><p>{f.observation}</p><p className="mt-1 text-xs text-slate-500">Source: {f.source_id} · Follow up: {f.follow_up || 'Review with department'}</p></div>)}</div>}
  </section>;
}