import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Search, Clock, FileEdit, Trash2, Upload, ShieldCheck, LogIn, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const actionConfig = {
  investigation_update: { icon: FileEdit, color: "text-blue-600", label: "Investigation Updated" },
  investigation_create: { icon: FileEdit, color: "text-blue-600", label: "Investigation Created" },
  data_ingestion: { icon: Upload, color: "text-indigo-600", label: "Data Ingested" },
  alert_created: { icon: ShieldCheck, color: "text-orange-600", label: "Alert Created" },
  transaction_flagged: { icon: ShieldCheck, color: "text-red-600", label: "Transaction Flagged" },
  login: { icon: LogIn, color: "text-emerald-600", label: "Login" },
  delete: { icon: Trash2, color: "text-red-600", label: "Deleted" },
};

export default function AuditLog() {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLogs() {
      try {
        const [investigations, transactions, alerts, batches, explicitLogs] = await Promise.all([
          base44.entities.Investigation.list("-created_date", 30),
          base44.entities.Transaction.list("-created_date", 30),
          base44.entities.Alert.list("-created_date", 20),
          base44.entities.IngestionBatch.list("-created_date", 20),
          base44.entities.AuditLogEntry.list("-created_date", 50).catch(() => []),
        ]);

        const built = [];
        investigations.forEach((i) => {
          built.push({ id: `inv_${i.id}`, timestamp: i.created_date, user: i.investigator || i.created_by_id || "System", action: "investigation_create", entity: "Investigation", detail: `Created investigation "${i.title}" for ${i.vendor || "N/A"}` });
          if (i.updated_date && i.updated_date !== i.created_date) {
            built.push({ id: `inv_u_${i.id}`, timestamp: i.updated_date, user: i.investigator || "System", action: "investigation_update", entity: "Investigation", detail: `Updated "${i.title}" — status: ${i.status}` });
          }
        });
        transactions.forEach((t) => {
          if (t.status === "flagged") {
            built.push({ id: `tx_${t.id}`, timestamp: t.created_date, user: "System", action: "transaction_flagged", entity: "Transaction", detail: `Flagged ${t.transaction_id} — ${t.vendor}, ${t.amount} ${t.currency || ""}` });
          }
        });
        alerts.forEach((a) => {
          built.push({ id: `al_${a.id}`, timestamp: a.created_date, user: a.assigned_to || "System", action: "alert_created", entity: "Alert", detail: `Alert: ${a.title} (${a.risk_level})` });
        });
        batches.forEach((b) => {
          built.push({ id: `bat_${b.id}`, timestamp: b.created_date, user: b.uploaded_by || "System", action: "data_ingestion", entity: "IngestionBatch", detail: `Uploaded ${b.filename} (${b.total_records} records)` });
        });
        explicitLogs.forEach((l) => {
          built.push({ id: `log_${l.id}`, timestamp: l.created_date, user: l.user, action: l.action, entity: l.entity_type, detail: l.detail, ip: l.ip_address });
        });

        built.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        setLogs(built);
      } catch (e) { console.error(e); }
      setLoading(false);
    }
    loadLogs();
  }, []);

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      if (search) {
        const q = search.toLowerCase();
        if (!`${l.user} ${l.detail} ${l.entity}`.toLowerCase().includes(q)) return false;
      }
      if (actionFilter && l.action !== actionFilter) return false;
      return true;
    });
  }, [logs, search, actionFilter]);

  const actionTypes = [...new Set(logs.map((l) => l.action))];

  const fmtTime = (ts) => {
    if (!ts) return "—";
    try { return new Date(ts).toLocaleString(); } catch { return ts; }
  };

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-slate-200 px-4 md:px-8 py-4 sticky top-0 z-10">
        <h1 className="text-lg font-bold text-[#231F20]">Audit Log</h1>
        <p className="text-xs text-slate-500">Complete system activity trail built from live entity data</p>
      </header>

      <div className="p-4 md:p-8">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by user, detail, or entity..." className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 focus:border-slate-400 focus:ring-1 focus:ring-slate-300 outline-none" />
          </div>
          <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="text-sm px-3 py-2 rounded-lg border border-slate-200 outline-none bg-white">
            <option value="">All Actions</option>
            {actionTypes.map((a) => <option key={a} value={a}>{actionConfig[a]?.label || a.replace(/_/g, " ")}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3">Timestamp</th>
                    <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3">User</th>
                    <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3">Action</th>
                    <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((l) => {
                    const cfg = actionConfig[l.action] || { icon: Clock, color: "text-slate-500", label: l.action };
                    const Icon = cfg.icon;
                    return (
                      <tr key={l.id} className="hover:bg-slate-50/60">
                        <td className="px-4 py-3 text-xs font-mono text-slate-500 whitespace-nowrap">{fmtTime(l.timestamp)}</td>
                        <td className="px-4 py-3 text-sm font-medium text-[#231F20]">{l.user}</td>
                        <td className="px-4 py-3">
                          <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", cfg.color)}>
                            <Icon className="w-3.5 h-3.5" /> {cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">{l.detail}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filtered.length === 0 && <p className="text-center text-sm text-slate-400 py-12">No log entries found</p>}
          </div>
        )}
      </div>
    </div>
  );
}