import React from "react";
import { Search } from "lucide-react";

export default function AuditFilters({ filters, onChange, sectors }) {
  const set = (field) => (event) => onChange((old) => ({ ...old, [field]: event.target.value }));
  const cls = "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-slate-300";
  return <div className="flex flex-wrap items-end gap-3">
    <label className="flex-1 min-w-[190px] text-xs text-slate-500">Search vendor or document ID
      <div className="relative mt-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input aria-label="Search vendor or document ID" value={filters.search} onChange={set("search")} placeholder="Search records..." className={`${cls} w-full pl-9`} /></div>
    </label>
    <label className="text-xs text-slate-500">Risk level<select aria-label="Risk level" value={filters.risk} onChange={set("risk")} className={`${cls} mt-1 block w-full`}><option value="">All levels</option>{["low", "medium", "high", "critical", "not scored"].map((r) => <option key={r} value={r}>{r.toUpperCase()}</option>)}</select></label>
    <label className="text-xs text-slate-500">Sector<select aria-label="Sector" value={filters.sector} onChange={set("sector")} className={`${cls} mt-1 block w-full max-w-[190px]`}><option value="">All sectors</option>{sectors.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
    <label className="text-xs text-slate-500">From<input aria-label="From date" type="date" value={filters.from} onChange={set("from")} className={`${cls} mt-1 block w-full`} /></label>
    <label className="text-xs text-slate-500">To<input aria-label="To date" type="date" value={filters.to} onChange={set("to")} className={`${cls} mt-1 block w-full`} /></label>
  </div>;
}