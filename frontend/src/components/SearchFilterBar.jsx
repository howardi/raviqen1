import React from "react";
import { Search, X } from "lucide-react";

export default function SearchFilterBar({
  searchValue, onSearchChange, searchPlaceholder = "Search...",
  dateFrom, onDateFromChange, dateTo, onDateToChange,
  selects = [], onClear,
}) {
  const hasActiveFilters = searchValue || dateFrom || dateTo || selects.some((s) => s.value);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3 mb-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[150px] w-full sm:w-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 focus:border-slate-400 focus:ring-1 focus:ring-slate-300 outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
            className="text-sm px-2.5 py-2 rounded-lg border border-slate-200 focus:border-slate-400 focus:ring-1 focus:ring-slate-300 outline-none flex-1"
          />
          <span className="text-xs text-slate-400 shrink-0">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
            className="text-sm px-2.5 py-2 rounded-lg border border-slate-200 focus:border-slate-400 focus:ring-1 focus:ring-slate-300 outline-none flex-1"
          />
        </div>

        {selects.map((sel) => (
          <select
            key={sel.key}
            value={sel.value}
            onChange={(e) => sel.onChange(e.target.value)}
            className="text-sm px-3 py-2 rounded-lg border border-slate-200 focus:border-slate-400 focus:ring-1 focus:ring-slate-300 outline-none bg-white w-full sm:w-auto"
          >
            <option value="">{sel.label}</option>
            {sel.options.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        ))}

        {hasActiveFilters && (
          <button
            onClick={onClear}
            className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <X className="w-3.5 h-3.5" /> Clear
          </button>
        )}
      </div>
    </div>
  );
}