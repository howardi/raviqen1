import React from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

export default function StatCard({ label, value, sublabel, icon: Icon, trend, trendUp, accent = "slate" }) {
  const accentMap = {
    slate: "from-slate-700 to-slate-900",
    blue: "from-blue-600 to-blue-800",
    teal: "from-teal-500 to-teal-700",
    amber: "from-amber-500 to-amber-600",
    red: "from-red-500 to-red-700",
    violet: "from-violet-600 to-violet-800",
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</span>
          <span className="text-2xl font-bold text-[#231F20] tabular-nums">{value}</span>
          {sublabel && <span className="text-xs text-slate-400">{sublabel}</span>}
        </div>
        {Icon && (
          <div className={cn("w-10 h-10 rounded-lg bg-gradient-to-br flex items-center justify-center text-white", accentMap[accent])}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
      {trend && (
        <div className="mt-3 flex items-center gap-1.5 text-xs">
          {trendUp ? (
            <TrendingUp className="w-3.5 h-3.5 text-red-500" />
          ) : (
            <TrendingDown className="w-3.5 h-3.5 text-emerald-500" />
          )}
          <span className={trendUp ? "text-red-600 font-medium" : "text-emerald-600 font-medium"}>{trend}</span>
          <span className="text-slate-400">vs last period</span>
        </div>
      )}
    </div>
  );
}