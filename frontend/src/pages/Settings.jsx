import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Users, Database, Bell, UserPlus, Shield, KeyRound, FileCheck, Loader2, Lock, Gauge, DollarSign } from "lucide-react";
import { useCurrency } from "@/lib/CurrencyContext";
import { CURRENCY_META } from "@/lib/currencyUtils";
import { ROLES } from "@/lib/permissions";
import CompanyProfileSection from "@/components/settings/CompanyProfileSection";
import NotificationSettingsSection from "@/components/settings/NotificationSettingsSection";
import AccessControlSection from "@/components/settings/AccessControlSection";
import BackupRestoreSection from "@/components/settings/BackupRestoreSection";
import DangerZoneSection from "@/components/settings/DangerZoneSection";
import BackToTop from "@/components/BackToTop";

export default function Settings() {
  const { toast } = useToast();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("standard_user");
  const [inviting, setInviting] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetting, setResetting] = useState(false);
  const [twoFactor, setTwoFactor] = useState(false);
  const [loginAlerts, setLoginAlerts] = useState(true);
  const [sessionTimeout, setSessionTimeout] = useState("30");

  const { baseCurrency, setBaseCurrency, displayCurrency, setDisplayCurrency } = useCurrency();

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setInviting(true);
    try {
      // Platform invite API only accepts "admin" or "user" — map the RAVIQEN role
      const platformRole = ["super_admin", "org_admin"].includes(inviteRole) ? "admin" : "user";
      await base44.users.inviteUser(inviteEmail, platformRole);
      // Try to set the RAVIQEN-specific role on the user record
      try {
        const users = await base44.entities.User.filter({ email: inviteEmail });
        if (users.length > 0 && users[0].id) {
          await base44.entities.User.update(users[0].id, { raviqen_role: inviteRole });
        }
      } catch (e2) { /* user may not exist yet — role applied when they join */ }
      toast({ title: "Invitation sent", description: `${inviteEmail} has been invited as ${ROLES[inviteRole]?.label || inviteRole}.` });
      setInviteEmail("");
    } catch (err) {
      toast({ title: "Error", description: err.message || "Failed to invite user", variant: "destructive" });
    } finally {
      setInviting(false);
    }
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    if (!resetEmail) return;
    setResetting(true);
    try {
      await base44.auth.resetPasswordRequest(resetEmail);
      toast({ title: "Reset link sent", description: "Check your email for password reset instructions." });
      setResetEmail("");
    } catch (err) {
      toast({ title: "Error", description: err.message || "Failed to send reset link", variant: "destructive" });
    } finally {
      setResetting(false);
    }
  };

  const supportedFormats = [
    { fmt: "PDF", desc: "Portable Document Format (.pdf)" },
    { fmt: "Word", desc: "Microsoft Word (.doc, .docx)" },
    { fmt: "JPEG", desc: "JPEG image (.jpg, .jpeg)" },
    { fmt: "PNG", desc: "PNG image (.png)" },
    { fmt: "Image", desc: "General images (GIF, BMP, WEBP)" },
  ];

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-slate-200 px-4 md:px-8 py-4 sticky top-0 z-10">
        <h1 className="text-lg font-bold text-[#231F20]">Settings</h1>
        <p className="text-xs text-slate-500">Configure your RAVIQEN workspace</p>
      </header>

      <div className="p-4 md:p-8 max-w-3xl space-y-5">
        <CompanyProfileSection />

        <NotificationSettingsSection />

        <AccessControlSection />

        {/* Create Account */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
              <UserPlus className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#231F20]">Create Account</h3>
              <p className="text-xs text-slate-500">Invite a new team member to RAVIQEN</p>
            </div>
          </div>
          <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-2">
            <input
              type="email"
              placeholder="email@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
              className="flex-1 text-sm px-3 py-2 rounded-lg border border-slate-200 focus:border-slate-400 focus:ring-1 focus:ring-slate-300 outline-none"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="text-sm px-3 py-2 rounded-lg border border-slate-200 focus:border-slate-400 outline-none bg-white"
            >
              {Object.entries(ROLES).map(([key, r]) => (
                <option key={key} value={key}>{r.label}</option>
              ))}
            </select>
            <button
              type="submit"
              disabled={inviting}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              Invite
            </button>
          </form>
        </div>

        {/* Security */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#231F20]">Security</h3>
              <p className="text-xs text-slate-500">Manage security and access preferences</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700">Two-Factor Authentication</p>
                <p className="text-xs text-slate-400">Require a verification code at sign-in</p>
              </div>
              <button
                onClick={() => setTwoFactor(!twoFactor)}
                className={`relative w-11 h-6 rounded-full transition-colors ${twoFactor ? "bg-slate-900" : "bg-slate-200"}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${twoFactor ? "translate-x-5" : ""}`} />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700">Login Alerts</p>
                <p className="text-xs text-slate-400">Notify on new device sign-ins</p>
              </div>
              <button
                onClick={() => setLoginAlerts(!loginAlerts)}
                className={`relative w-11 h-6 rounded-full transition-colors ${loginAlerts ? "bg-slate-900" : "bg-slate-200"}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${loginAlerts ? "translate-x-5" : ""}`} />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700">Session Timeout</p>
                <p className="text-xs text-slate-400">Auto-logout after inactivity</p>
              </div>
              <select
                value={sessionTimeout}
                onChange={(e) => setSessionTimeout(e.target.value)}
                className="text-sm px-3 py-1.5 rounded-lg border border-slate-200 outline-none bg-white"
              >
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
                <option value="60">1 hour</option>
                <option value="240">4 hours</option>
              </select>
            </div>
          </div>
        </div>

        {/* Password */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
              <KeyRound className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#231F20]">Password</h3>
              <p className="text-xs text-slate-500">Reset your account password</p>
            </div>
          </div>
          <form onSubmit={handlePasswordReset} className="space-y-3">
            <p className="text-xs text-slate-500">Enter your email to receive a secure password reset link.</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                placeholder="your@email.com"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
                className="flex-1 text-sm px-3 py-2 rounded-lg border border-slate-200 focus:border-slate-400 focus:ring-1 focus:ring-slate-300 outline-none"
              />
              <button
                type="submit"
                disabled={resetting}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
              >
                {resetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                Send Reset Link
              </button>
            </div>
          </form>
        </div>

        {/* Supported Formats */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
              <FileCheck className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#231F20]">Supported Formats</h3>
              <p className="text-xs text-slate-500">File types accepted for data ingestion</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {supportedFormats.map((f) => (
              <div key={f.fmt} className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-50/60">
                <span className="text-xs font-mono font-semibold text-slate-700">{f.fmt}</span>
                <span className="text-xs text-slate-400">{f.desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Base Currency */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
              <DollarSign className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#231F20]">Base Currency</h3>
              <p className="text-xs text-slate-500">Default reporting currency for your organization</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700">Base Currency</p>
                <p className="text-xs text-slate-400">Currency amounts are stored in</p>
              </div>
              <select
                value={baseCurrency}
                onChange={(e) => setBaseCurrency(e.target.value)}
                className="text-sm px-3 py-1.5 rounded-lg border border-slate-200 outline-none bg-white"
              >
                {Object.entries(CURRENCY_META).map(([code, m]) => (
                  <option key={code} value={code}>{m.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700">Display Currency</p>
                <p className="text-xs text-slate-400">Currency shown across the dashboard</p>
              </div>
              <select
                value={displayCurrency}
                onChange={(e) => setDisplayCurrency(e.target.value)}
                className="text-sm px-3 py-1.5 rounded-lg border border-slate-200 outline-none bg-white"
              >
                {Object.entries(CURRENCY_META).map(([code, m]) => (
                  <option key={code} value={code}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <BackupRestoreSection />

        <DangerZoneSection />

        {/* Existing settings */}
        {[
          { icon: Users, title: "Users & Roles", desc: "Manage team members and role-based access control" },
          { icon: Gauge, title: "Risk Thresholds", desc: "Configure anomaly detection rules and scoring weights" },
          { icon: Database, title: "Data Sources", desc: "Connect and manage your data ingestion pipelines" },
          { icon: Bell, title: "Notifications", desc: "Alert routing and notification preferences" },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.title} className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4 hover:shadow-sm transition-shadow cursor-pointer">
              <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#231F20]">{item.title}</h3>
                <p className="text-xs text-slate-500">{item.desc}</p>
              </div>
            </div>
          );
        })}

        <BackToTop />
      </div>
    </div>
  );
}