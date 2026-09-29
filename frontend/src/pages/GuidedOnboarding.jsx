import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, CalendarClock, Building2, Mail, User, Users, Clock, GraduationCap, CheckCircle2, ArrowRight, Briefcase, RefreshCw, LogIn } from "lucide-react";

const INDUSTRY_OPTIONS = ["Hospitality / Restaurant", "Retail", "Finance / Banking", "Healthcare", "Manufacturing", "Logistics", "Technology", "Other"];
const TEAM_SIZES = ["1-10", "11-50", "51-200", "201-500", "500+"];

const inputCls = "w-full text-sm px-3 py-2.5 rounded-lg border border-slate-200 focus:border-slate-400 focus:ring-1 focus:ring-slate-300 outline-none";

const STATUS_META = {
  pending: { label: "Awaiting scheduling", badge: "bg-amber-50 text-amber-700 border-amber-200", icon: Clock },
  scheduled: { label: "Call scheduled", badge: "bg-blue-50 text-blue-700 border-blue-200", icon: CalendarClock },
  completed: { label: "Onboarding complete", badge: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  rejected: { label: "Rejected", badge: "bg-red-50 text-red-700 border-red-200", icon: Clock },
};

function Field({ label, required, icon: Icon, children }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-1.5">
        {Icon && <Icon className="w-3.5 h-3.5 text-slate-400" />}
        {label}{required && <span className="text-red-400">*</span>}
      </label>
      {children}
    </div>
  );
}

export default function GuidedOnboarding() {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [existing, setExisting] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    organization_name: "",
    contact_name: "",
    contact_email: user?.email || "",
    industry: "",
    team_size: "",
    preferred_call_time: "",
    training_needs: "",
  });

  useEffect(() => {
    (async () => {
      try {
        const records = await base44.entities.OnboardingRequest.filter({ user_id: user?.id });
        if (records && records.length > 0) setExisting(records[0]);
      } catch (e) { /* none yet */ }
      setLoading(false);
    })();
  }, [user?.id]);

  // Re-check access status periodically so that when an admin approves the
  // request, the user is automatically routed off the onboarding page instead
  // of being stuck on it. Also expose a manual "Check access" button below.
  const checkAccess = useCallback(async () => {
    const fresh = await refreshUser();
    if (fresh && fresh.account_status !== "pending_setup") {
      toast({ title: "Access granted", description: "Your account has been approved. Taking you to your dashboard." });
      navigate("/dashboard", { replace: true });
      return true;
    }
    return false;
  }, [refreshUser, navigate, toast]);

  const [checkingAccess, setCheckingAccess] = useState(false);

  useEffect(() => {
    if (!existing) return;
    const interval = setInterval(() => {
      checkAccess();
    }, 15000);
    return () => clearInterval(interval);
  }, [existing, checkAccess]);

  const handleManualCheck = async () => {
    setCheckingAccess(true);
    const ok = await checkAccess();
    if (!ok) {
      toast({ title: "Still pending", description: "Your access hasn't been approved yet. We'll check automatically.", variant: "destructive" });
    }
    setCheckingAccess(false);
  };

  const handleChange = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.organization_name || !form.contact_email || !form.preferred_call_time) {
      toast({ title: "Please fill required fields", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const created = await base44.entities.OnboardingRequest.create({
        ...form,
        user_id: user?.id,
        status: "pending",
      });
      setExisting(created);
      toast({ title: "Onboarding request submitted", description: "Our team will reach out shortly to schedule your call." });
    } catch (err) {
      toast({ title: "Error", description: err.message || "Failed to submit", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-4 md:px-8 py-5">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 mb-1">
            <CalendarClock className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Guided Onboarding</span>
          </div>
          <h1 className="text-xl font-bold text-[#231F20]">Let's set up your RAVIQEN workspace</h1>
          <p className="text-sm text-slate-500 mt-1">Account setup requires a brief onboarding consultation with our team.</p>
        </div>
      </header>

      <div className="p-4 md:p-8 max-w-2xl">
        {existing ? (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-[#231F20]">Request received</h2>
                <p className="text-xs text-slate-500 mt-1">
                  We've received your onboarding request for <span className="font-medium text-slate-700">{existing.organization_name}</span>.
                  Our team will contact you at <span className="font-medium text-slate-700">{existing.contact_email}</span> to schedule your call.
                </p>
              </div>
            </div>
            <div className="mt-4">
              {(() => {
                const meta = STATUS_META[existing.status] || STATUS_META.pending;
                const Icon = meta.icon;
                return (
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${meta.badge}`}>
                    <Icon className="w-3.5 h-3.5" /> {meta.label}
                  </span>
                );
              })()}
            </div>
            <div className="mt-5 pt-5 border-t border-slate-100 space-y-2 text-xs text-slate-500">
              <p><span className="font-medium text-slate-600">Preferred time:</span> {existing.preferred_call_time}</p>
              {existing.training_needs && <p><span className="font-medium text-slate-600">Training needs:</span> {existing.training_needs}</p>}
            </div>
            <p className="mt-5 text-xs text-slate-400">
              Your account status is <span className="font-medium text-amber-600">Pending Setup</span> until an admin
              completes your onboarding call and unlocks access. We check automatically every few seconds — once
              approved, you'll be taken straight to your dashboard.
            </p>
            <button
              onClick={handleManualCheck}
              disabled={checkingAccess}
              className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              {checkingAccess ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {checkingAccess ? "Checking…" : "Check my access status"}
            </button>
            <button
              onClick={() => navigate("/login", { replace: true })}
              className="mt-2 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              <LogIn className="w-4 h-4" /> Back to login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-5 md:p-6 space-y-4">
            <Field label="Organization Name" required icon={Building2}>
              <input value={form.organization_name} onChange={handleChange("organization_name")} required placeholder="Acme Inc." className={inputCls} />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Contact Name" icon={User}>
                <input value={form.contact_name} onChange={handleChange("contact_name")} placeholder="Your name" className={inputCls} />
              </Field>
              <Field label="Contact Email" required icon={Mail}>
                <input type="email" value={form.contact_email} onChange={handleChange("contact_email")} required placeholder="you@company.com" className={inputCls} />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Industry" icon={Briefcase}>
                <select value={form.industry} onChange={handleChange("industry")} className={`${inputCls} bg-white`}>
                  <option value="">Select industry</option>
                  {INDUSTRY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </Field>
              <Field label="Team Size" icon={Users}>
                <select value={form.team_size} onChange={handleChange("team_size")} className={`${inputCls} bg-white`}>
                  <option value="">Select size</option>
                  {TEAM_SIZES.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Preferred Call Time" required icon={Clock}>
              <input value={form.preferred_call_time} onChange={handleChange("preferred_call_time")} required placeholder="e.g. Weekdays 9–11am, next Tuesday afternoon" className={inputCls} />
            </Field>
            <Field label="Training Needs" icon={GraduationCap}>
              <textarea value={form.training_needs} onChange={handleChange("training_needs")} rows={3} placeholder="What would you like covered? (e.g. investigations, data ingestion, HR module)" className={`${inputCls} resize-none`} />
            </Field>
            <button type="submit" disabled={submitting} className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors min-h-[44px]">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              {submitting ? "Submitting..." : "Request Setup"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}