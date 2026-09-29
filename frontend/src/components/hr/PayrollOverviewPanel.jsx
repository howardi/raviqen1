import React from "react";
import { DollarSign, Clock, TrendingDown, AlertTriangle, Users, UserX } from "lucide-react";

export default function PayrollOverviewPanel({ summary = {} }) {
  const stats = [
    { label: "Total Net Pay", value: `$${(summary.total_net || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: DollarSign, color: "text-slate-700 bg-slate-100" },
    { label: "Overtime Payout", value: `$${(summary.total_overtime || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: Clock, color: "text-indigo-600 bg-indigo-50" },
    { label: "Total Deductions", value: `$${(summary.total_deductions || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: TrendingDown, color: "text-amber-600 bg-amber-50" },
    { label: "Flagged Records", value: summary.flagged_count || 0, icon: AlertTriangle, color: "text-red-600 bg-red-50" },
    { label: "Employees", value: summary.total_employees || 0, icon: Users, color: "text-blue-600 bg-blue-50" },
    { label: "Ghost Workers", value: summary.ghost_workers || 0, icon: UserX, color: "text-orange-600 bg-orange-50" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {stats.map((s) => {
        const SIcon = s.icon;
        return (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${s.color}`}>
              <SIcon className="w-4 h-4" />
            </div>
            <p className="text-base font-bold text-[#231F20] tabular-nums truncate">{s.value}</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-wide">{s.label}</p>
          </div>
        );
      })}
    </div>
  );
}