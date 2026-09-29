import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Bell, ShieldAlert, X } from "lucide-react";
import { Link } from "react-router-dom";
import RiskBadge from "@/components/RiskBadge";
import { formatCurrency } from "@/lib/currencyUtils";
import { useAuth } from "@/lib/AuthContext";
import { normalizeUserRole } from "@/lib/permissions";
import { isOversightManagerRole } from "@/lib/oversight";

export default function NotificationBell() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [reports, setReports] = useState([]);
  const [open, setOpen] = useState(false);
  const count = alerts.length + reports.length;

  useEffect(() => {
    (async () => {
      try {
        const data = await base44.entities.Alert.list("-created_date", 20);
        const highRisk = data.filter(
          (a) => a.status === "open" && (a.risk_level === "high" || a.risk_level === "critical")
        );
        setAlerts(highRisk);
      } catch (e) {}
      if (user && isOversightManagerRole(normalizeUserRole(user))) {
        try {
          const notes = await base44.entities.OversightNotification.filter({ user_id: user.id }, "-created_date", 20);
          setReports(notes.filter((n) => !n.read_at && n.tenant_id === user.tenant_id));
        } catch (e) {}
      }
    })();
  }, [user?.id, user?.tenant_id]);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
      >
        <Bell className="w-4 h-4 text-slate-600" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl border border-slate-200 shadow-lg z-50 max-h-96 overflow-y-auto">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-500" />
                <h3 className="text-sm font-semibold text-[#231F20]">Notifications</h3>
              </div>
              <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-slate-100">
                <X className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </div>
            {reports.length > 0 && (
              <div className="divide-y divide-slate-100 border-b border-slate-100">
                {reports.map((note) => (
                  <Link
                    key={note.id}
                    to={note.department ? `/oversight/${note.department}` : "/oversight"}
                    onClick={async () => {
                      setOpen(false);
                      try { await base44.entities.OversightNotification.update(note.id, { read_at: new Date().toISOString() }); } catch (e) {}
                    }}
                    className="block px-4 py-3 hover:bg-slate-50"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">New report</p>
                    <p className="text-xs font-medium text-[#231F20] truncate">{note.title}</p>
                  </Link>
                ))}
              </div>
            )}
            {alerts.length === 0 && reports.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell className="w-8 h-8 mx-auto text-slate-200 mb-2" />
                <p className="text-xs text-slate-400">No new notifications</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {alerts.map((alert) => (
                  <Link
                    key={alert.id}
                    to="/alerts"
                    onClick={() => setOpen(false)}
                    className="block px-4 py-3 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <RiskBadge level={alert.risk_level} size="sm" />
                      <span className="text-xs text-slate-400">
                        {new Date(alert.created_date).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-[#231F20] truncate">{alert.title}</p>
                    <p className="text-xs text-slate-500">
                      {alert.vendor} · {formatCurrency(alert.amount, alert.currency)}
                    </p>
                  </Link>
                ))}
              </div>
            )}
            <Link
              to="/alerts"
              onClick={() => setOpen(false)}
              className="block px-4 py-2.5 text-center text-xs font-medium text-slate-600 hover:bg-slate-50 border-t border-slate-100"
            >
              View All Alerts →
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
