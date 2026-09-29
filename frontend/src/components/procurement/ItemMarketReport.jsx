import React from "react";
import { AlertTriangle, ShieldCheck, ShieldX } from "lucide-react";

const styles = {
  "RULE-PG-01": { icon: ShieldCheck, className: "text-emerald-700 bg-emerald-50" },
  "RULE-PG-02": { icon: AlertTriangle, className: "text-amber-800 bg-amber-50" },
  "RULE-PG-03": { icon: ShieldX, className: "text-red-700 bg-red-50" },
  "RULE-PG-04": { icon: ShieldX, className: "text-red-700 bg-red-50" },
};

export default function ItemMarketReport({ item }) {
  const rule = item.arithmetic_finding ? "RULE-PG-04" : item.flagged_rule;
  const style = styles[rule] || { icon: AlertTriangle, className: "text-slate-700 bg-slate-100" };
  const Icon = style.icon;
  const safeUrl = (() => {
    try { const url = new URL(item.market_source_url); return ["http:", "https:"].includes(url.protocol) ? url.href : null; }
    catch { return null; }
  })();
  return (
    <article className="rounded-lg border border-slate-200 bg-slate-50/40 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-800">{item.item_description}</h3>
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold shrink-0 ${style.className}`}>
          <Icon className="w-3.5 h-3.5" /> {rule || "Not priced"}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
        <p><span className="block text-slate-500">Quoted unit price{item.quantity ? ` · Qty ${item.quantity}` : ""}</span><strong>{item.quoted_unit_price || item.invoice_unit_price || "Unavailable"}</strong>{item.quoted_unit_price && item.invoice_unit_price !== "Unavailable" && item.quoted_unit_price !== item.invoice_unit_price && <span className="block text-slate-500">≈ {item.invoice_unit_price} per unit</span>}</p>
        <p><span className="block text-slate-500">Indicative market unit value</span><strong>{item.nigerian_market_avg || "Unavailable"}</strong></p>
        <p><span className="block text-slate-500">Difference</span><strong>{item.calculated_variance_percent || "Not calculated"}</strong></p>
      </div>
      <p className="text-xs leading-relaxed text-slate-700">{item.comparison || `${item.status || "Not assessed"}. Quoted ${item.invoice_unit_price || "unavailable"} versus market ${item.nigerian_market_avg || "unavailable"}; variance ${item.calculated_variance_percent || "not calculated"}.`}</p>
      {item.arithmetic_finding && <p className="text-xs font-medium text-red-700"><AlertTriangle className="w-3.5 h-3.5 inline mr-1" />{item.arithmetic_finding}</p>}
      <p className="text-xs text-slate-600"><span className="font-medium">Market basis: </span>{item.market_basis || "No documented comparable source"}{item.confidence && ` · ${item.confidence} confidence`}</p>
      {safeUrl ? <a href={safeUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-700 underline break-all">View market listing</a> : <p className="text-xs text-amber-700">No direct market listing supplied; verify this comparison before relying on it.</p>}
    </article>
  );
}