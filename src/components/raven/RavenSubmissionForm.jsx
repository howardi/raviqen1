import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';

export default function RavenSubmissionForm({ department }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [date, setDate] = useState(() => new Date().toLocaleDateString('en-CA'));
  const [priority, setPriority] = useState('normal');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      await base44.functions.invoke('submitDepartmentReport', { department, title, content, report_date: date, priority });
      setTitle(''); setContent(''); setPriority('normal'); setMessage('Report submitted to the Raviqen Inbox.');
    } catch (e) { setError(e.response?.data?.error || e.message || 'Unable to submit report.'); }
    finally { setBusy(false); }
  };
  return <form onSubmit={submit} className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 md:p-7">
    <h2 className="text-lg font-semibold text-slate-900">Submit daily report</h2>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block text-sm font-medium text-slate-700">Report date<input required type="date" value={date} onChange={e => setDate(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 p-2.5" /></label>
      <label className="block text-sm font-medium text-slate-700">Priority<select value={priority} onChange={e => setPriority(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 p-2.5"><option value="normal">Normal</option><option value="urgent">Urgent</option></select></label>
    </div>
    <label className="block text-sm font-medium text-slate-700">Report title<input required maxLength={200} value={title} onChange={e => setTitle(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 p-2.5" placeholder="Today's report" /></label>
    <label className="block text-sm font-medium text-slate-700">Report content<textarea required maxLength={20000} rows={8} value={content} onChange={e => setContent(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 p-2.5" placeholder="Summarise activities, outcomes, and issues…" /></label>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {message && <p role="status" className="text-sm font-medium text-emerald-700">{message}</p>}
    <button disabled={busy || !title.trim() || !content.trim()} className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50">{busy ? 'Submitting…' : 'Submit report'}</button>
  </form>;
}