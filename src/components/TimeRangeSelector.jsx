import React from "react";
import { cn } from "@/lib/utils";
import { Calendar } from "lucide-react";

export const TIME_RANGES = [
  { key: "7d", label: "7 Days", days: 7 },
  { key: "30d", label: "30 Days", days: 30 },
  { key: "90d", label: "90 Days", days: 90 },
  { key: "all", label: "All Time", days: null },
];

export function getDateRangeStart(rangeKey) {
  const range = TIME_RANGES.find((r) => r.key === rangeKey);
  if (!range || range.days == null) return null;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - range.days);
  return d;
}

export function filterByDateRange(items, rangeKey, dateFields = ["created_date"]) {
  const start = getDateRangeStart(rangeKey);
  if (!start) return items;
  return items.filter((item) => {
    for (const f of dateFields) {
      const d = new Date(item[f]);
      if (!isNaN(d) && d >= start) return true;
    }
    return false;
  });
}

export function buildTrendData(transactions, rangeKey) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const start = getDateRangeStart(rangeKey);
  const buckets = [];

  if (rangeKey === "7d") {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      buckets.push({ label: d.toLocaleDateString("en", { weekday: "short" }), flagged: 0, clean: 0, start: new Date(d) });
    }
  } else if (rangeKey === "30d") {
    for (let i = 9; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i * 3);
      buckets.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, flagged: 0, clean: 0, start: new Date(d) });
    }
  } else if (rangeKey === "90d") {
    for (let i = 12; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i * 7);
      buckets.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, flagged: 0, clean: 0, start: new Date(d) });
    }
  } else {
    const earliest = transactions.reduce((min, t) => {
      const d = new Date(t.created_date || t.transaction_date);
      return d < min && !isNaN(d) ? d : min;
    }, new Date());
    if (isNaN(earliest) || earliest > now) {
      buckets.push({ label: now.toLocaleDateString("en", { month: "short" }), flagged: 0, clean: 0, start: new Date(now.getFullYear(), now.getMonth(), 1) });
    } else {
      let cursor = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
      while (cursor <= now) {
        buckets.push({ label: cursor.toLocaleDateString("en", { month: "short" }), flagged: 0, clean: 0, start: new Date(cursor) });
        cursor.setMonth(cursor.getMonth() + 1);
      }
    }
  }

  transactions.forEach((t) => {
    const d = new Date(t.created_date || t.transaction_date);
    if (isNaN(d)) return;
    if (start && d < start) return;
    let target = null;
    for (const b of buckets) {
      if (b.start <= d) target = b;
      else break;
    }
    if (target) {
      if (t.status === "flagged") target.flagged++;
      else target.clean++;
    }
  });

  return buckets.map(({ start, ...rest }) => rest);
}

export default function TimeRangeSelector({ value, onChange, className }) {
  return (
    <div className={cn("inline-flex items-center gap-0.5 p-1 bg-white border border-slate-200 rounded-lg", className)}>
      <Calendar className="w-3.5 h-3.5 text-slate-400 ml-1.5 mr-0.5 shrink-0" />
      {TIME_RANGES.map((r) => (
        <button
          key={r.key}
          onClick={() => onChange(r.key)}
          className={cn(
            "px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap",
            value === r.key ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}