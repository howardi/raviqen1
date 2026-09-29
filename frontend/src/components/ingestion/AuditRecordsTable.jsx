import React from "react";
import RiskBadge from "@/components/RiskBadge";

export default function AuditRecordsTable({ records, loading }) {
  if (loading) return <p className="p-12 text-center text-sm text-slate-500" role="status">Loading ingestion history…</p>;
  if (!records.length) return <p className="p-12 text-center text-sm text-slate-500">No ingestion records match your filters.</p>;
  return <div className="overflow-x-auto"><table className="w-full min-w-[960px] text-left text-sm">
    <thead className="bg-slate-50 text-xs text-slate-600"><tr>{["Timestamp (UTC)", "Document ID", "Entity Name", "Sector", "Amount & Currency", "Risk Score & Level", "Status"].map((h) => <th key={h} scope="col" className="px-4 py-3 font-semibold">{h}</th>)}</tr></thead>
    <tbody className="divide-y divide-slate-100">{records.map((r) => <tr key={r.id} className="align-top hover:bg-slate-50/60">
      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{r.timestamp ? new Date(r.timestamp).toISOString().replace("T", " ").slice(0, 19) : "—"}</td>
      <td className="px-4 py-3 font-mono text-xs text-slate-700"><span className="block max-w-[110px] truncate" title={r.source_reference || r.document_id}>{r.source_reference || r.document_id}</span>{r.source_reference && <span className="mt-1 block text-[10px] text-slate-400" title={`Unique document ID: ${r.document_id}`}>ID: {r.document_id.slice(0, 8)}…</span>}</td>
      <td className="px-4 py-3 font-medium text-slate-800">{r.entity_name}<p className="mt-1 max-w-[160px] line-clamp-2 text-xs font-normal text-slate-500" title={r.verdict_summary}>{r.verdict_summary}</p></td>
      <td className="px-4 py-3 text-slate-600">{r.sector}</td>
      <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums text-slate-800">{r.formatted_amount}<span className="ml-1 text-xs font-normal text-slate-500">{r.currency_iso}</span></td>
      <td className="whitespace-nowrap px-4 py-3"><span className="mr-2 font-semibold tabular-nums">{r.risk_score == null ? "—" : `${r.risk_score}/100`}</span>{r.risk_level === "not scored" ? <span className="text-xs">Not scored</span> : <RiskBadge level={r.risk_level} size="sm" />}</td>
      <td className="px-4 py-3 text-xs font-medium text-slate-700">{r.status.replaceAll("_", " ")}</td>
    </tr>)}</tbody>
  </table></div>;
}