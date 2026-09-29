import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronRight, ShieldAlert } from "lucide-react";

export default function FraudSignalCard({ signal }) {
  const [open, setOpen] = useState(false);
  return <article className="rounded-xl border border-slate-200 bg-white overflow-hidden">
    <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="w-full flex items-start gap-3 p-4 text-left hover:bg-slate-50">
      <ShieldAlert className="w-4 h-4 mt-0.5 text-amber-700 shrink-0" />
      <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-800">{signal.title}</span>
        <span className="block mt-1 text-xs text-slate-500">{signal.subject} · {signal.reference} · {signal.source} · {signal.risk || "Review"} risk</span></span>
      {open ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
    </button>
    {open && <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-700 space-y-2">
      <p><strong>Trigger:</strong> {signal.rule} · {signal.field}: {String(signal.value)}</p>
      {signal.detail && <p>{signal.detail}</p>}
      {signal.batchId && <Link to={`/ingestion-audit?batch=${encodeURIComponent(signal.batchId)}`} className="font-medium text-blue-700 hover:underline">View source batch →</Link>}
    </div>}
  </article>;
}