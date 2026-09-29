import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { logActivity } from "@/lib/activityLogger";
import { createEntityProfile, recomputeAllProfiles, mergeEntities } from "@/lib/entityIntelligence";
import EntityProfileCard from "@/components/entity/EntityProfileCard";
import EntityProfileForm from "@/components/entity/EntityProfileForm";
import EntityMergeDialog from "@/components/entity/EntityMergeDialog";
import BackToTop from "@/components/BackToTop";
import { Plus, RefreshCw, GitMerge, Loader2, Building2, Search, ShieldAlert, TrendingUp, AlertTriangle } from "lucide-react";

export default function EntityIntelligence() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [merging, setMerging] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState("");

  const loadProfiles = useCallback(async () => {
    try {
      const data = await base44.entities.EntityProfile.list("-risk_score", 200);
      setProfiles(data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    loadProfiles();
    // Real-time subscription
    const unsubscribe = base44.entities.EntityProfile.subscribe((event) => {
      loadProfiles();
    });
    return unsubscribe;
  }, [loadProfiles]);

  const filtered = profiles.filter((p) => {
    if (search) {
      const q = search.toLowerCase();
      if (!`${p.legal_name || ""} ${p.trading_name || ""} ${p.profile_id || ""} ${p.tax_id || ""}`.toLowerCase().includes(q)) return false;
    }
    if (riskFilter && p.risk_level !== riskFilter) return false;
    if (statusFilter && p.status !== statusFilter) return false;
    return true;
  });

  const stats = {
    total: profiles.length,
    highRisk: profiles.filter((p) => p.risk_level === "high" || p.risk_level === "critical").length,
    underReview: profiles.filter((p) => p.status === "under_review" || p.status === "suspended").length,
    totalExposure: profiles.reduce((s, p) => s + (p.lifetime_exposure || 0), 0),
  };

  const handleCreate = () => { setEditing(null); setFormOpen(true); };
  const handleEdit = (profile) => { setEditing(profile); setFormOpen(true); };

  const handleSubmit = async (formData) => {
    setSaving(true);
    try {
      if (editing) {
        const { id, ...updates } = formData;
        await base44.entities.EntityProfile.update(editing.id, updates);
        await logActivity(user, "entity_profile_edit", `Updated entity profile: ${formData.legal_name}`, "EntityProfile", editing.id);
      } else {
        const created = await createEntityProfile(formData, user);
        await logActivity(user, "entity_profile_create", `Created entity profile: ${formData.legal_name}`, "EntityProfile", created.id);
      }
      setFormOpen(false);
      await loadProfiles();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleSyncAll = async () => {
    setSyncing(true);
    setSyncProgress("Recalculating all profiles…");
    try {
      await recomputeAllProfiles(user, (done, total) => setSyncProgress(`${done}/${total} profiles synced`));
      await loadProfiles();
      await logActivity(user, "entity_sync_all", "Recomputed all entity profiles", "EntityProfile", null);
    } catch (e) { console.error(e); }
    finally { setSyncing(false); setSyncProgress(""); }
  };

  const handleMerge = async (sourceId, targetId) => {
    setMerging(true);
    try {
      await mergeEntities(sourceId, targetId, user);
      setMergeOpen(false);
      await loadProfiles();
    } catch (e) { console.error(e); }
    finally { setMerging(false); }
  };

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-slate-200 px-4 md:px-8 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[#231F20]">Entity Intelligence</h1>
              <p className="text-xs text-slate-500">Persistent company profiles · continuous risk scoring · automated investigations</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={handleSyncAll} disabled={syncing || profiles.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors">
              {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              {syncing ? (syncProgress || "Syncing…") : "Sync All"}
            </button>
            <button onClick={() => setMergeOpen(true)} disabled={profiles.length < 2}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors">
              <GitMerge className="w-3.5 h-3.5" /> Merge
            </button>
            <button onClick={handleCreate}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 transition-colors">
              <Plus className="w-3.5 h-3.5" /> New Profile
            </button>
          </div>
        </div>
      </header>

      <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatBox icon={Building2} label="Total Entities" value={stats.total} color="slate" />
          <StatBox icon={ShieldAlert} label="High / Critical Risk" value={stats.highRisk} color="red" />
          <StatBox icon={AlertTriangle} label="Under Review" value={stats.underReview} color="amber" />
          <StatBox icon={TrendingUp} label="Total Exposure" value={stats.totalExposure.toLocaleString()} color="violet" />
        </div>

        {/* Search & Filters */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, tax ID, profile ID…"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 focus:border-slate-400 focus:ring-1 focus:ring-slate-300 outline-none" />
          </div>
          <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)}
            className="text-sm px-3 py-2 rounded-lg border border-slate-200 outline-none bg-white">
            <option value="">All Risk Levels</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm px-3 py-2 rounded-lg border border-slate-200 outline-none bg-white">
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="under_review">Under Review</option>
            <option value="suspended">Suspended</option>
            <option value="blacklisted">Blacklisted</option>
          </select>
        </div>

        {/* Profile Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="h-44 rounded-xl bg-slate-100 animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
            <Building2 className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <h3 className="text-sm font-semibold text-slate-700 mb-1">{profiles.length === 0 ? "No entity profiles yet" : "No profiles match your filters"}</h3>
            <p className="text-xs text-slate-400 mb-4">
              {profiles.length === 0 ? "Create profiles manually or ingest transaction data — the engine auto-extracts and resolves entities." : "Try adjusting your search or filters."}
            </p>
            {profiles.length === 0 && (
              <button onClick={handleCreate} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800">
                <Plus className="w-4 h-4" /> Create First Profile
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((p) => <EntityProfileCard key={p.id} profile={p} />)}
          </div>
        )}
      </div>

      <EntityProfileForm open={formOpen} onOpenChange={setFormOpen} onSubmit={handleSubmit} editing={editing} saving={saving} />
      <EntityMergeDialog open={mergeOpen} onOpenChange={setMergeOpen} profiles={profiles} onMerge={handleMerge} merging={merging} />
      <BackToTop />
    </div>
  );
}

function StatBox({ icon: Icon, label, value, color }) {
  const colorMap = { slate: "text-slate-700 bg-slate-100", red: "text-red-700 bg-red-100", amber: "text-amber-700 bg-amber-100", violet: "text-violet-700 bg-violet-100" };
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${colorMap[color]}`}><Icon className="w-4.5 h-4.5" /></div>
      <div><p className="text-xl font-bold text-[#231F20] tabular-nums leading-none">{value}</p><p className="text-[10px] text-slate-400 uppercase tracking-wide mt-1">{label}</p></div>
    </div>
  );
}