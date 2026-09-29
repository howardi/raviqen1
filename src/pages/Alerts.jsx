import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { ShieldAlert, Search } from "lucide-react";
import AlertCard from "@/components/AlertCard";
import { useAuth } from "@/lib/AuthContext";
import { logActivity } from "@/lib/activityLogger";
import { stampTenant } from "@/lib/tenantScope";
import BackToTop from "@/components/BackToTop";
import EmptyState from "@/components/EmptyState";
import TimeRangeSelector, { filterByDateRange } from "@/components/TimeRangeSelector";

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [timeRange, setTimeRange] = useState("30d");
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    (async () => {
      try {
        const data = await base44.entities.Alert.list("-created_date", 100);
        setAlerts(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleCreateInvestigation = async (alert) => {
    try {
      const inv = await base44.entities.Investigation.create(stampTenant({
        title: alert.title,
        transaction_id: alert.transaction_id,
        alert_id: alert.id,
        vendor: alert.vendor,
        status: "open",
        risk_level: alert.risk_level,
        outcome: "pending",
      }, user));
      await base44.entities.Alert.update(alert.id, { status: "investigating" });
      await logActivity(user, "create_investigation", `Created investigation from alert: ${alert.title}`, "Alert", alert.id);
      navigate(`/investigations/${inv.id}`);
    } catch (e) {
      console.error(e);
    }
  };

  const filtered = alerts.filter((a) => {
    const statusMatch = filter === "all" || a.status === filter;
    const searchMatch = !search ||
      a.title?.toLowerCase().includes(search.toLowerCase()) ||
      a.vendor?.toLowerCase().includes(search.toLowerCase()) ||
      a.transaction_id?.toLowerCase().includes(search.toLowerCase());
    return statusMatch && searchMatch;
  });
  const dateFiltered = filterByDateRange(filtered, timeRange, ["created_date"]);

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-slate-200 px-4 md:px-8 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-bold text-[#231F20]">Risk Alerts</h1>
            <p className="text-xs text-slate-500">All flagged transactions requiring review</p>
          </div>
          <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
        </div>
      </header>

      <div className="p-4 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center gap-3 mb-5">
          <div className="flex items-center gap-2 flex-wrap">
            {["all", "open", "investigating", "resolved", "dismissed"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                  filter === f ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="relative md:ml-auto md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search alerts, vendor, ID..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:border-slate-400 focus:ring-1 focus:ring-slate-300 outline-none"
            />
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-20 rounded-xl bg-slate-100 animate-pulse" />)}
          </div>
        ) : dateFiltered.length === 0 ? (
          alerts.length === 0 ? (
            <EmptyState
              icon={ShieldAlert}
              title="No reports generated"
              description="Connect your business data to begin autonomous monitoring."
              ctaLabel="Ingest Data"
              ctaTo="/ingestion"
            />
          ) : (
            <div className="text-center py-20 bg-white rounded-xl border border-slate-200">
              <ShieldAlert className="w-10 h-10 mx-auto text-slate-300 mb-3" />
              <p className="text-sm text-slate-500">No alerts match your filters{search ? " or search term" : ""}.</p>
            </div>
          )
        ) : (
          <div className="space-y-2.5">
            {dateFiltered.map((alert) => (
              <AlertCard key={alert.id} alert={alert} onClick={handleCreateInvestigation} />
            ))}
          </div>
        )}
      </div>

      <BackToTop />
    </div>
  );
}