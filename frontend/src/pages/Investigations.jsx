import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { FileSearch, CheckSquare, Square, X, Loader2, Calendar, RefreshCw, LayoutGrid, List } from "lucide-react";
import RiskBadge from "@/components/RiskBadge";
import { useToast } from "@/components/ui/use-toast";
import KanbanBoard from "@/components/investigation/KanbanBoard";
import SearchFilterBar from "@/components/SearchFilterBar";
import BackToTop from "@/components/BackToTop";
import EmptyState from "@/components/EmptyState";
import { useAuth } from "@/lib/AuthContext";
import { logActivity } from "@/lib/activityLogger";

const statusStyles = {
  open: "bg-slate-100 text-slate-600",
  in_progress: "bg-blue-50 text-blue-700",
  concluded: "bg-emerald-50 text-emerald-700",
};

const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "concluded", label: "Concluded" },
];

export default function Investigations() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [investigations, setInvestigations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkAction, setBulkAction] = useState("");
  const [assignName, setAssignName] = useState("");
  const [bulkStatus, setBulkStatus] = useState("open");
  const [bulkDate, setBulkDate] = useState("");
  const [acting, setActing] = useState(false);
  const [viewMode, setViewMode] = useState("list");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [riskLevel, setRiskLevel] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState("");

  const loadInvestigations = async () => {
    try {
      const data = await base44.entities.Investigation.list("-created_date", 50);
      setInvestigations(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadInvestigations(); }, []);

  const filtered = investigations.filter((i) => {
    if (filter !== "all" && i.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!`${i.title || ""} ${i.transaction_id || ""} ${i.vendor || ""} ${i.investigator || ""}`.toLowerCase().includes(q)) return false;
    }
    if (riskLevel && i.risk_level !== riskLevel) return false;
    if (outcomeFilter && i.outcome !== outcomeFilter) return false;
    if (dateFrom || dateTo) {
      const d = i.created_date ? new Date(i.created_date) : null;
      if (!d) return false;
      if (dateFrom && d < new Date(dateFrom)) return false;
      if (dateTo && d > new Date(dateTo + "T23:59:59")) return false;
    }
    return true;
  });

  const handleDragEnd = async (result) => {
    if (!result.destination) return;
    const invId = result.draggableId;
    const newStatus = result.destination.droppableId;
    if (result.source.droppableId === newStatus) return;
    setInvestigations(prev => prev.map(i => i.id === invId ? { ...i, status: newStatus } : i));
    try {
      await base44.entities.Investigation.update(invId, { status: newStatus });
      await logActivity(user, "update_investigation_status", `Moved investigation to ${newStatus.replace("_", " ")}`, "Investigation", invId);
      toast({ title: "Status updated", description: `Investigation moved to ${newStatus.replace("_", " ")}.` });
    } catch (e) {
      setInvestigations(prev => prev.map(i => i.id === invId ? { ...i, status: result.source.droppableId } : i));
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map(i => i.id));
    }
  };

  const clearSelection = () => { setSelectedIds([]); setBulkAction(""); setAssignName(""); setBulkDate(""); };

  const handleBulkAction = async () => {
    if (selectedIds.length === 0 || !bulkAction) return;
    setActing(true);
    try {
      if (bulkAction === "assign") {
        if (!assignName.trim()) return;
        await base44.entities.Investigation.bulkUpdate(
          selectedIds.map(id => ({ id, investigator: assignName.trim() }))
        );
        toast({ title: "Investigations assigned", description: `${selectedIds.length} investigations assigned to ${assignName.trim()}.` });
      } else if (bulkAction === "status") {
        await base44.entities.Investigation.bulkUpdate(
          selectedIds.map(id => ({ id, status: bulkStatus }))
        );
        toast({ title: "Status updated", description: `${selectedIds.length} investigations marked as ${bulkStatus}.` });
      } else if (bulkAction === "date") {
        if (!bulkDate) return;
        await base44.entities.Investigation.bulkUpdate(
          selectedIds.map(id => ({ id, follow_up_date: bulkDate }))
        );
        toast({ title: "Follow-up dates set", description: `${selectedIds.length} investigations scheduled for ${new Date(bulkDate).toLocaleDateString()}.` });
      } else if (bulkAction === "delete") {
        await base44.entities.Investigation.deleteMany({ id: { $in: selectedIds } });
        toast({ title: "Investigations deleted", description: `${selectedIds.length} investigations removed.` });
      }
      await logActivity(user, "bulk_" + bulkAction, `${selectedIds.length} investigations: ${bulkAction}`, "Investigation", selectedIds.join(","));
      clearSelection();
      await loadInvestigations();
    } catch (e) {
      toast({ title: "Error", description: e.message || "Bulk action failed", variant: "destructive" });
    } finally {
      setActing(false);
    }
  };

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-slate-200 px-4 md:px-8 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-[#231F20]">Investigations</h1>
            <p className="text-xs text-slate-500">Track and resolve flagged transactions</p>
            <Link to="/oversight/investigation" className="mt-1 inline-block text-xs font-medium text-blue-700 underline">Open the daily-operations investigation report</Link>
          </div>
          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 shrink-0">
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-md transition-colors ${viewMode === "list" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("kanban")}
              className={`p-1.5 rounded-md transition-colors ${viewMode === "kanban" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="p-4 md:p-8">
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          {["all", "open", "in_progress", "concluded"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                filter === f ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {f === "in_progress" ? "In Progress" : f}
            </button>
          ))}
        </div>

        <SearchFilterBar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search by title, transaction ID, vendor, or investigator..."
          dateFrom={dateFrom}
          onDateFromChange={setDateFrom}
          dateTo={dateTo}
          onDateToChange={setDateTo}
          selects={[
            { key: "risk", label: "All Risk Levels", value: riskLevel, onChange: setRiskLevel, options: [
              { value: "low", label: "Low" },
              { value: "medium", label: "Medium" },
              { value: "high", label: "High" },
              { value: "critical", label: "Critical" },
            ]},
            { key: "outcome", label: "All Outcomes", value: outcomeFilter, onChange: setOutcomeFilter, options: [
              { value: "pending", label: "Pending" },
              { value: "confirmed_anomaly", label: "Confirmed Anomaly" },
              { value: "false_positive", label: "False Positive" },
              { value: "process_error", label: "Process Error" },
              { value: "escalated", label: "Escalated" },
            ]},
            ]}
            onClear={() => { setSearch(""); setDateFrom(""); setDateTo(""); setRiskLevel(""); setOutcomeFilter(""); }}
        />

        {/* Bulk action bar */}
        {selectedIds.length > 0 && (
          <div className="mb-4 p-3 rounded-xl bg-slate-900 text-white flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium">{selectedIds.length} selected</span>
            <div className="flex items-center gap-2 flex-1 flex-wrap">
              <select
                value={bulkAction}
                onChange={(e) => setBulkAction(e.target.value)}
                className="text-sm px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white outline-none"
              >
                <option value="" className="text-slate-900">Choose action...</option>
                <option value="assign" className="text-slate-900">Assign Investigator</option>
                <option value="status" className="text-slate-900">Change Status</option>
                <option value="date" className="text-slate-900">Set Follow-up Date</option>
                <option value="delete" className="text-slate-900">Delete</option>
              </select>
              {bulkAction === "assign" && (
                <input
                  type="text"
                  value={assignName}
                  onChange={(e) => setAssignName(e.target.value)}
                  placeholder="Investigator name"
                  className="text-sm px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50 outline-none"
                />
              )}
              {bulkAction === "status" && (
                <select
                  value={bulkStatus}
                  onChange={(e) => setBulkStatus(e.target.value)}
                  className="text-sm px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white outline-none"
                >
                  {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value} className="text-slate-900">{s.label}</option>)}
                </select>
              )}
              {bulkAction === "date" && (
                <input
                  type="date"
                  value={bulkDate}
                  onChange={(e) => setBulkDate(e.target.value)}
                  className="text-sm px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white outline-none"
                />
              )}
              {bulkAction && (
                <button
                  onClick={handleBulkAction}
                  disabled={acting || (bulkAction === "assign" && !assignName.trim()) || (bulkAction === "date" && !bulkDate)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-slate-900 text-sm font-medium hover:bg-slate-100 disabled:opacity-50 transition-colors"
                >
                  {acting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Apply
                </button>
              )}
            </div>
            <button onClick={clearSelection} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 rounded-xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={FileSearch}
            title="No investigations found"
            description="Anomalies and risk signals will appear here once your systems are synced."
            ctaLabel="Ingest Data"
            ctaTo="/ingestion"
          />
        ) : viewMode === "kanban" ? (
          <KanbanBoard investigations={filtered} onDragEnd={handleDragEnd} />
        ) : (
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 px-2">
              <button onClick={toggleSelectAll} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700">
                {selectedIds.length === filtered.length && filtered.length > 0 ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                {selectedIds.length === filtered.length && filtered.length > 0 ? "Deselect All" : "Select All"}
              </button>
            </div>
            {filtered.map((inv) => (
              <div key={inv.id} className="flex items-center gap-3">
                <button onClick={() => toggleSelect(inv.id)} className="shrink-0 p-1">
                  {selectedIds.includes(inv.id) ? <CheckSquare className="w-4 h-4 text-slate-900" /> : <Square className="w-4 h-4 text-slate-300" />}
                </button>
                <Link
                  to={`/investigations/${inv.id}`}
                  className="flex-1 block bg-white rounded-xl border border-slate-200 p-4 hover:border-slate-300 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <RiskBadge level={inv.risk_level} size="sm" />
                          <span
                            className={`text-[10px] font-medium px-1.5 py-0.5 rounded uppercase tracking-wide ${
                              statusStyles[inv.status] || statusStyles.open
                            }`}
                          >
                            {inv.status?.replace("_", " ")}
                          </span>
                          {inv.investigator && (
                            <span className="text-[10px] text-slate-400">· {inv.investigator}</span>
                          )}
                        </div>
                        <h4 className="text-sm font-semibold text-[#231F20] truncate">{inv.title}</h4>
                        <p className="text-xs text-slate-500 font-mono">{inv.transaction_id} · {inv.vendor}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs text-slate-400 capitalize">{inv.outcome?.replace("_", " ")}</span>
                      {inv.follow_up_date && (
                        <p className="text-[10px] text-blue-600 mt-1 flex items-center gap-1 justify-end">
                          <Calendar className="w-3 h-3" /> {new Date(inv.follow_up_date).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      <BackToTop />
    </div>
  );
}