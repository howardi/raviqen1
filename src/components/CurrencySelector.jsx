import React, { useState } from "react";
import { useCurrency } from "@/lib/CurrencyContext";
import { CURRENCY_META } from "@/lib/currencyUtils";
import { ChevronDown } from "lucide-react";

export default function CurrencySelector() {
  const { displayCurrency, setDisplayCurrency } = useCurrency();
  const [open, setOpen] = useState(false);
  const meta = CURRENCY_META[displayCurrency] || CURRENCY_META.USD;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
      >
        <span className="text-base leading-none">{meta.symbol}</span>
        <span>{displayCurrency}</span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg border border-slate-200 shadow-lg z-20 py-1 max-h-72 overflow-y-auto">
            {Object.entries(CURRENCY_META).map(([code, m]) => (
              <button
                key={code}
                onClick={() => { setDisplayCurrency(code); setOpen(false); }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 transition-colors text-left ${code === displayCurrency ? "bg-slate-50 font-medium" : ""}`}
              >
                <span className="text-base w-5 text-center">{m.symbol}</span>
                <span className="font-medium">{code}</span>
                <span className="text-xs text-slate-400 ml-auto truncate">{m.label.split(" - ")[1]}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}