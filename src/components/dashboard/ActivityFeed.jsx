import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Activity, Loader2 } from "lucide-react";

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

export default function ActivityFeed({ maxItems = 8 }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await base44.entities.AuditLogEntry.list("-created_date", maxItems);
        setEvents(data || []);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();

    const unsubscribe = base44.entities.AuditLogEntry.subscribe((event) => {
      if (event.type === "create") {
        setEvents((prev) => [event.data, ...prev].slice(0, maxItems));
      }
    });
    return () => unsubscribe();
  }, [maxItems]);

  const formatTime = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-slate-600" />
          <h3 className="text-sm font-semibold text-[#231F20]">Recent Activity</h3>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[9px] font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> LIVE
          </span>
        </div>
      </div>
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
      ) : events.length === 0 ? (
        <div className="text-center py-8">
          <Activity className="w-7 h-7 mx-auto text-slate-200 mb-2" />
          <p className="text-xs text-slate-400">No recent activity</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {events.map((event) => (
            <div key={event.id} className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-sm shrink-0">
                {EVENT_ICONS[event.action] || EVENT_ICONS.default}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-700 line-clamp-1">
                  <span className="font-medium text-[#231F20]">{event.user || "System"}</span>{" "}
                  <span className="text-slate-500">{event.detail || event.action}</span>
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">{formatTime(event.created_date)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}