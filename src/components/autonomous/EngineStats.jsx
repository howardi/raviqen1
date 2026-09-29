import React from "react";
import { Radar, AlertTriangle, FileSearch, Building2, Zap, Loader2 } from "lucide-react";

export default function EngineStats({ scans = [], loading }) {
  const total = scans.length;
  const totalRecords = scans.reduce((s, sc) => s + (sc.total_records || 0), 0);
  const totalAlerts = scans.reduce((s, sc) => s + (sc.alerts_generated || 0), 0);
  const totalCases = scans.reduce((s, sc) => s + (sc.cases_opened || 0) + (sc.cases_updated || 0), 0);
  const totalEntities = scans.reduce((s, sc) => s + (sc.new_entities || 0), 0);
  const scanning = scans.filter((s) => s.status === "scanning").length;

  const stats = [
    { label: "Total Scans", value: total, icon: Radar, color: "slate" },
    { label: "Records Processed", value: totalRecords, icon: Zap, color: "blue" },
    { label: "Alerts Generated", value: totalAlerts, icon: AlertTriangle, color: "amber" },
    { label: "Cases Built", value: totalCases, icon: FileSearch, color: "violet" },
    { label: "New Entities", value: totalEntities, icon: Building2, color: "teal" },
  ];

  const colorMap = {
    slate: "from-slate-600 to-slate-800",
    blue: "from-blue-600 to-blue-800",
    amber: "from-amber-500 to-amber-600",
    violet: "from-violet-600 to-violet-800",
    teal: "from-teal-500 to-teal-700",
  };

  return (
    <div className="space-y-4">
      {/* Engine status banner */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl p-5 text-white flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center">
            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Radar className="w-6 h-6" />}
          </div>
          <div>
            <h3 className="text-sm font-bold">Autonomous Scanning Engine</h3>
            <p className="text-xs text-slate-300">
              {scanning > 0 ? `${scanning} scan(s) in progress…` : "Listening across all ingestion touchpoints"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${scanning > 0 ? "bg-amber-400 animate-pulse" : "bg-emerald-400"}`} />
          <span className="text-xs font-medium">{scanning > 0 ? "ACTIVE SCAN" : "READY"}</span>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${colorMap[s.color]} flex items-center justify-center text-white mb-3`}>
                <Icon className="w-4.5 h-4.5" />
              </div>
              <p className="text-2xl font-bold text-[#231F20] tabular-nums leading-none">{s.value}</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wide mt-1.5">{s.label}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}