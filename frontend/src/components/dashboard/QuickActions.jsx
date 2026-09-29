import React from "react";
import { Link } from "react-router-dom";
import { Upload, FileSearch, ShieldAlert, ClipboardList, Download } from "lucide-react";

const ACTIONS = [
  { to: "/ingestion", label: "Ingest Data", icon: Upload, color: "bg-blue-50 text-blue-700 border-blue-100" },
  { to: "/investigations", label: "New Investigation", icon: FileSearch, color: "bg-violet-50 text-violet-700 border-violet-100" },
  { to: "/alerts", label: "Review Alerts", icon: ShieldAlert, color: "bg-amber-50 text-amber-700 border-amber-100" },
  { to: "/daily-reports", label: "Submit Report", icon: ClipboardList, color: "bg-teal-50 text-teal-700 border-teal-100" },
  { to: "/reports-exports", label: "Export Report", icon: Download, color: "bg-emerald-50 text-emerald-700 border-emerald-100" },
];

export default function QuickActions() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h3 className="text-sm font-semibold text-[#231F20] mb-3">Quick Actions</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.to}
              to={action.to}
              className={`flex flex-col items-center gap-2 p-3 rounded-lg border text-center transition-all hover:shadow-sm hover:scale-[1.02] ${action.color}`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs font-medium leading-tight">{action.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}