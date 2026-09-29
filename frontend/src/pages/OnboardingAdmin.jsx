import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { ROLES } from "@/lib/permissions";
import { DEFAULT_FEATURE_FLAGS } from "@/lib/defaultFlags";
import { logActivity } from "@/lib/activityLogger";
import { getOnboardingMode, setOnboardingMode } from "@/lib/onboardingMode";
import { Loader2, ClipboardCheck, Users, CalendarClock, CheckCircle2, Lock, Unlock } from "lucide-react";
import BackToTop from "@/components/BackToTop";

const STATUS_BADGE = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  scheduled: "bg-blue-50 text-blue-700 border-blue-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
};

export default function OnboardingAdmin() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [mode, setMode] = useState("self_serve");
  const [modeLoading, setModeLoading] = useState(true);
  const [savingMode, setSavingMode] = useState(false);
  const [requests, setRequests] = useState([]);
  const [loadingReqs, setLoadingReqs] = useState(true);
  const [actionId, setActionId] = useState(null);
  const [assignRole, setAssignRole] = useState({});

  useEffect(() => {
    (async () => {
      const m = await getOnboardingMode();
      setMode(m);
      setModeLoading(false);
      loadRequests();
    })();
  }, []);

  const loadRequests = async () => {
    setLoadingReqs(true);
    try {
      const data = await base44.entities.OnboardingRequest.list("-created_date", 100);
      setRequests(data || []);
    } catch (e) {
      toast({ title: "Error", description: "Failed to load requests", variant: "destructive" });
    } finally {
      setLoadingReqs(false);
    }
  };

  const handleSaveMode = async () => {
    setSavingMode(true);
    try {
      await setOnboardingMode(mode);
      await logActivity(currentUser, "admin_onboarding_mode_change", `Onboarding mode → ${mode}`);
      toast({ title: "Onboarding mode updated", description: `New signups will use ${mode === "guided" ? "Guided Onboarding" : "Self-Serve"} mode.` });
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSavingMode(false);
    }
  };

  const handleUnlock = async (req) => {
    const role = assignRole[req.id] || "standard_user";
    setActionId(req.id);
    try {
      const platformRole = ["super_admin", "org_admin", "company_admin"].includes(role) ? "admin" : "user";
      await base44.entities.User.update(req.user_id, {
        account_status: "active",
        raviqen_role: role,
        role: platformRole,
        feature_flags: DEFAULT_FEATURE_FLAGS,
      });
      const nowIso = new Date().toISOString();
      await base44.entities.OnboardingRequest.update(req.id, {
        status: "completed",
        unlocked_by: currentUser?.id,
        unlocked_date: nowIso,
      });
      await logActivity(currentUser, "admin_onboarding_unlock", `Unlocked ${req.contact_email}: role → ${ROLES[role]?.label}`);
      setRequests((prev) => prev.map((r) => (r.id === req.id ? { ...r, status: "completed", unlocked_by: currentUser?.id, unlocked_date: nowIso } : r)));
      toast({ title: "User unlocked", description: `${req.contact_email} can now access RAVIQEN as ${ROLES[role]?.label}.` });
    } catch (err) {
      toast({ title: "Unlock failed", description: err.message, variant: "destructive" });
    } finally {
      setActionId(null);
    }
  };

  const handleStatusChange = async (req, status) => {
    setActionId(req.id);
    try {
      await base44.entities.OnboardingRequest.update(req.id, { status });
      setRequests((prev) => prev.map((r) => (r.id === req.id ? { ...r, status } : r)));
      toast({ title: "Status updated", description: `Request marked as ${status}.` });
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-slate-200 px-4 md:px-8 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center shrink-0">
            <ClipboardCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[#231F20]">Onboarding Management</h1>
            <p className="text-xs text-slate-500">Control the new-user onboarding flow and review setup requests</p>
          </div>
        </div>
      </header>

      <div className="p-4 md:p-8 max-w-5xl space-y-5">
        {/* Mode toggle */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#231F20]">New User Onboarding Mode</h3>
              <p className="text-xs text-slate-500">Choose how new domain sign-ups are handled</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { key: "self_serve", title: "Self-Serve Mode", desc: "New users get standard pending access and can be activated by an admin directly." },
              { key: "guided", title: "Guided Onboarding Mode", desc: "New users must submit an onboarding request and complete a setup call before access is unlocked." },
            ].map((opt) => (
              <button
                key={opt.key}
                onClick={() => setMode(opt.key)}
                className={`text-left p-4 rounded-xl border-2 transition-all ${mode === opt.key ? "border-emerald-500 bg-emerald-50/50" : "border-slate-200 hover:border-slate-300"}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-[#231F20]">{opt.title}</span>
                  {mode === opt.key && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">{opt.desc}</p>
              </button>
            ))}
          </div>
          <div className="mt-4 flex justify-end">
            <button onClick={handleSaveMode} disabled={savingMode || modeLoading} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors">
              {savingMode ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Save Mode
            </button>
          </div>
        </div>

        {/* Requests */}
        <div>
          <h2 className="text-sm font-semibold text-[#231F20] mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-500" /> Onboarding Requests
          </h2>
          {loadingReqs ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
          ) : requests.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
              <CalendarClock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No onboarding requests yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((req) => (
                <div key={req.id} className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-[#231F20]">{req.organization_name}</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${STATUS_BADGE[req.status] || STATUS_BADGE.pending}`}>{req.status}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{req.contact_name ? `${req.contact_name} · ` : ""}{req.contact_email}</p>
                      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500">
                        {req.industry && <p><span className="text-slate-400">Industry:</span> {req.industry}</p>}
                        {req.team_size && <p><span className="text-slate-400">Team:</span> {req.team_size}</p>}
                        <p><span className="text-slate-400">Preferred time:</span> {req.preferred_call_time}</p>
                      </div>
                      {req.training_needs && <p className="mt-1 text-xs text-slate-500"><span className="text-slate-400">Training:</span> {req.training_needs}</p>}
                    </div>
                    <div className="shrink-0 flex flex-col gap-2 sm:w-48">
                      {req.status !== "completed" ? (
                        <>
                          <select
                            value={assignRole[req.id] || "standard_user"}
                            onChange={(e) => setAssignRole((p) => ({ ...p, [req.id]: e.target.value }))}
                            className="text-xs px-2 py-1.5 rounded-lg border border-slate-200 bg-white outline-none"
                          >
                            {Object.entries(ROLES).filter(([k]) => k !== "pending").map(([k, r]) => (
                              <option key={k} value={k}>{r.label}</option>
                            ))}
                          </select>
                          <button onClick={() => handleUnlock(req)} disabled={actionId === req.id} className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                            {actionId === req.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Unlock className="w-3 h-3" />}
                            Unlock & Activate
                          </button>
                          {req.status === "pending" && (
                            <button onClick={() => handleStatusChange(req, "scheduled")} disabled={actionId === req.id} className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-xs font-medium hover:bg-blue-100 disabled:opacity-50 transition-colors">
                              <CalendarClock className="w-3 h-3" /> Mark Scheduled
                            </button>
                          )}
                        </>
                      ) : (
                        <div className="text-xs text-emerald-600 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Unlocked
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <BackToTop />
    </div>
  );
}