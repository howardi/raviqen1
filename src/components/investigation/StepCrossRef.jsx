import React, { useState } from "react";
import { Link2, Search, CheckCircle2, XCircle, AlertTriangle, Loader2, Database, BookOpen, Store, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const sourceConfig = {
  quickbooks: { label: "QuickBooks", icon: BookOpen, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200" },
  ezee_burrp: { label: "Ezee Burrp", icon: Store, color: "text-teal-600", bg: "bg-teal-50", border: "border-teal-200" },
};

const statusConfig = {
  matches: { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50", label: "Matches" },
  discrepancy: { icon: AlertTriangle, color: "text-orange-600", bg: "bg-orange-50", label: "Discrepancy" },
  not_found: { icon: XCircle, color: "text-red-600", bg: "bg-red-50", label: "Not Found" },
  pending: { icon: Loader2, color: "text-slate-400", bg: "bg-slate-100", label: "Pending" },
};

const statusOrder = ["matches", "discrepancy", "not_found"];

export default function StepCrossRef({ sourceRecords, loading, onLookup, onMarkRecord, connectionStatus }) {
  const [activeSource, setActiveSource] = useState(null);

  const allMarked = sourceRecords.length > 0 && sourceRecords.every((r) => r.match_status !== "pending");

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-bold text-[#231F20]">Step 3 — Source Data Cross-Reference</h2>
        <p className="text-xs text-slate-500">Corroborate the flagged transaction against QuickBooks financials and Ezee Burrp POS data</p>
      </div>

      {/* Connection status + lookup triggers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(sourceConfig).map(([key, cfg]) => {
          const Icon = cfg.icon;
          const connected = connectionStatus?.[key]?.connected;
          const records = sourceRecords.filter((r) => r.source_type === key);
          return (
            <div key={key} className={cn("bg-white rounded-xl border p-5", cfg.border)}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", cfg.bg)}>
                    <Icon className={cn("w-4 h-4", cfg.color)} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#231F20]">{cfg.label}</h3>
                    <p className="text-[11px] text-slate-400">
                      {connected ? "Connected" : connectionStatus?.[key]?.needsUpgrade ? "Requires Builder+ upgrade" : "Not connected"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => { setActiveSource(key); onLookup(key); }}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
                >
                  {loading && activeSource === key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  Run Lookup
                </button>
              </div>
              {records.length > 0 ? (
                <p className="text-[11px] text-slate-500">{records.length} record(s) found · {records.filter((r) => r.match_status !== "pending").length} reviewed</p>
              ) : (
                <p className="text-[11px] text-slate-400 italic">No lookup performed yet</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Cross-reference results table */}
      {sourceRecords.length > 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100">
            <Database className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-semibold text-[#231F20]">Cross-Reference Results</h3>
            <span className="ml-auto text-xs text-slate-400">{sourceRecords.length} records</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50/60 text-slate-500">
                <tr>
                  <th className="text-left font-medium px-4 py-2.5">Source</th>
                  <th className="text-left font-medium px-4 py-2.5">Type</th>
                  <th className="text-left font-medium px-4 py-2.5">Vendor / Customer</th>
                  <th className="text-right font-medium px-4 py-2.5">Amount</th>
                  <th className="text-left font-medium px-4 py-2.5">Date</th>
                  <th className="text-center font-medium px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sourceRecords.map((rec) => {
                  const cfg = sourceConfig[rec.source_type];
                  return (
                    <tr key={rec.id || rec.external_id} className="hover:bg-slate-50/40">
                      <td className="px-4 py-3">
                        <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium", cfg.bg, cfg.color)}>
                          <cfg.icon className="w-3 h-3" />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 capitalize">{rec.record_type}</td>
                      <td className="px-4 py-3 text-slate-700 font-medium">{rec.vendor}</td>
                      <td className="px-4 py-3 text-right text-slate-700 tabular-nums">${Number(rec.amount || 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-slate-500">{rec.record_date || "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          {statusOrder.map((st) => {
                            const sCfg = statusConfig[st];
                            const SIcon2 = sCfg.icon;
                            return (
                              <button
                                key={st}
                                onClick={() => onMarkRecord(rec, st)}
                                title={sCfg.label}
                                className={cn(
                                  "p-1 rounded transition-colors",
                                  rec.match_status === st ? cn(sCfg.bg, sCfg.color) : "text-slate-300 hover:text-slate-500"
                                )}
                              >
                                <SIcon2 className="w-3.5 h-3.5" />
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-slate-100 flex items-center gap-2">
            {allMarked ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" /> All records reviewed
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                <Info className="w-3.5 h-3.5" /> Mark each record as Matches, Discrepancy, or Not Found to proceed
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
          <Link2 className="w-10 h-10 mx-auto text-slate-200 mb-3" />
          <p className="text-sm text-slate-400">Run a lookup on either source to cross-reference this transaction.</p>
        </div>
      )}
    </div>
  );
}