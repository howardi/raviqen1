import React from "react";
import { Newspaper, AlertTriangle, TrendingUp, ShieldCheck, Globe } from "lucide-react";

const NEWS_ITEMS = [
  { icon: AlertTriangle, text: "FATF updates guidance on virtual asset service providers", color: "text-amber-400" },
  { icon: ShieldCheck, text: "New sanctions regime targets procurement fraud networks", color: "text-emerald-400" },
  { icon: TrendingUp, text: "FinCEN issues alert on ghost employee payroll schemes", color: "text-blue-400" },
  { icon: Globe, text: "EU AMLD6 enforcement deadlines approaching — compliance review required", color: "text-violet-400" },
  { icon: AlertTriangle, text: "Adverse media screening now mandatory for vendor onboarding", color: "text-amber-400" },
  { icon: ShieldCheck, text: "Regulators announce crackdown on trade-based money laundering", color: "text-emerald-400" },
  { icon: TrendingUp, text: "Cross-border payment fraud rises 23% in Q3 — real-time monitoring advised", color: "text-blue-400" },
  { icon: Globe, text: "New AI detection tools deployed for autonomous transaction monitoring", color: "text-violet-400" },
];

export default function NewsTicker() {
  const items = [...NEWS_ITEMS, ...NEWS_ITEMS];
  return (
    <div className="relative overflow-hidden bg-[#0d0f14] border-y border-slate-800/60 backdrop-blur-sm py-2 sm:py-2.5">
      <div className="flex items-center gap-2 sm:gap-3 px-4">
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 z-10 bg-slate-900 pr-3 sm:pr-4">
          <Newspaper className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
          <span className="text-[10px] sm:text-xs font-bold text-white uppercase tracking-wider">Weekly Live News</span>
        </div>
        <div className="flex animate-marquee gap-6 sm:gap-8 whitespace-nowrap">
          {items.map((item, i) => {
            const Icon = item.icon;
            return (
              <span key={i} className="inline-flex items-center gap-2 text-xs sm:text-sm text-slate-300">
                <Icon className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${item.color}`} />
                {item.text}
                <span className="text-slate-600 ml-3 sm:ml-4">•</span>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}