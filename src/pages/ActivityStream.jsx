import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Activity, Loader2, Radio, Filter } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { normalizeUserRole, isAdminRole } from "@/lib/permissions";
import BackToTop from "@/components/BackToTop";

const EVENT_ICONS = {
  create_investigation: "🔍",
  delete_transaction: "🗑️",
  data_ingestion: "📥",
  daily_report_submit: "📋",
  daily_report_comment: "💬",
  daily_report_flag: "🚩",
  manual_account_created: "🔑",
  invitation_sent: "✉️",
  password_reset: "🔐",
  credentials_revoked: "⛔",
  role_change: "👥",
  default: "⚡",
};

const EVENT_COLORS = {
  create_investigation: "text-blue-600 bg-blue-50",
  delete_transaction: "text-red-600 bg-red-50",
  data_ingestion: "text-teal-600 bg-teal-50",
  daily_report_submit: "text-violet-600 bg-violet-50",
  daily_report_comment: "text-amber-600 bg-amber-50",
  daily_report_flag: "text-red-600 bg-red-50",
  manual_account_created: "text-orange-600 bg-orange-50",
  invitation_sent: "text-cyan-600 bg-cyan-50",
  password_reset: "text-amber-600 bg-amber-50",
  credentials_revoked: "text-red-600 bg-red-50",
  role_change: "text-emerald-600 bg-emerald-50",
  default: "text-slate-600 bg-slate-100",
};

export default function ActivityStream() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [live, setLive] = useState(true);
  const { user } = useAuth();
  const role = normalizeUserRole(user);
  const isAdmin = isAdminRole(role);
  const feedRef = useRef(null);

  useEffect(() => {
    loadEvents();
    // Real-time subscription
    const unsubscribe = base44.entities.AuditLogEntry.subscribe((event) => {
      if (event.type === "create") {
        setEvents((prev) => [event.data, ...prev].slice(0, 100));
      }
    });
    return () => unsubscribe();
  }, []);

  const loadEvents = async () => {
    try {
      const data = await base44.entities.AuditLogEntry.list("-created_date", 100);
      setEvents(data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const filtered = filter === "all" ? events : events.filter((e) => {
    const action = (e.action || "").toLowerCase();
    return action.includes(filter);
  });

  const eventTypes = [
    { key: "all", label: "All Events" },
    { key: "investigation", label: "Investigations" },
    { key: "ingestion", label: "Data Ingestion" },
    { key: "daily_report", label: "Daily Reports" },
    { key: "password", label: "Credentials" },
    { key: "role", label: "Role Changes" },
  ];

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-slate-200 px-4 md:px-8 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-bold text-[#231F20] flex items-center gap-2">
              <Activity className="w-5 h-5 text-slate-600" /> Real-time Activity Stream
            </h1>
            <p className="text-xs text-slate-500">Live system events · investigations, alerts, ingestion, logins</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLive(!live)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${live ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-500 border-slate-200"}`}
            >
              <Radio className={`w-3.5 h-3.5 ${live ? "animate-pulse" : ""}`} /> {live ? "Live" : "Paused"}
            </button>
          </div>
        </div>
      </header>

      <div className="p-4 md:p-8 max-w-4xl">
        {/* Filter bar */}
        <div className="flex items-center gap-2 flex-wrap mb-4">
          <Filter className="w-4 h-4 text-slate-400" />
          {eventTypes.map((t) => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === t.key ? "bg-slate-900 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Live feed */}
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
            <Activity className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <p className="text-sm text-slate-400">No activity events yet</p>
          </div>
        ) : (
          <div ref={feedRef} className="space-y-2">
            {filtered.map((event, idx) => {
              const icon = EVENT_ICONS[event.action] || EVENT_ICONS.default;
              const color = EVENT_COLORS[event.action] || EVENT_COLORS.default;
              const time = new Date(event.created_date).toLocaleString();
              return (
                <div key={event.id} className="bg-white rounded-xl border border-slate-200 p-3.5 flex items-start gap-3 hover:bg-slate-50/60 transition-colors">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-base shrink-0 ${color}`}>{icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-[#231F20]">{event.user || "System"}</span>
                      <span className="text-xs text-slate-400">·</span>
                      <span className="text-xs text-slate-500 font-mono">{event.action || "event"}</span>
                      {idx === 0 && live && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[9px] font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> NEW
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">{event.detail || "No details"}</p>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-400">
                      <span>{time}</span>
                      {event.ip_address && <span>· IP: {event.ip_address}</span>}
                      {event.entity_type && <span>· {event.entity_type}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <BackToTop />
    </div>
  );
}