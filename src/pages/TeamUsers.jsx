import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";
import { ROLES, normalizeUserRole, isAdminRole, canManageCredentials } from "@/lib/permissions";
import { logCredentialEvent } from "@/lib/activityLogger";
import { UserPlus, Loader2, Mail, Shield, KeyRound, Lock, Eye, EyeOff, UserX, AlertTriangle } from "lucide-react";
import CreatePasswordModal from "@/components/CreatePasswordModal";
import CredentialActionsMenu from "@/components/CredentialActionsMenu";
import { validatePassword, getPasswordStrength, STRENGTH_COLORS } from "@/lib/passwordPolicy";

export default function TeamUsers() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("standard_user");
  const [inviting, setInviting] = useState(false);
  const [resettingId, setResettingId] = useState(null);
  const [createPwTarget, setCreatePwTarget] = useState(null);
  const [resetPwTarget, setResetPwTarget] = useState(null);
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [revoking, setRevoking] = useState(false);
  const [inviteMode, setInviteMode] = useState("link");
  const [manualPassword, setManualPassword] = useState("");
  const [manualConfirm, setManualConfirm] = useState("");
  const [showManualPw, setShowManualPw] = useState(false);
  const [requireManualChange, setRequireManualChange] = useState(true);

  const manualValidation = validatePassword(manualPassword);
  const manualStrength = getPasswordStrength(manualPassword);
  const manualMatchError = manualConfirm.length > 0 && manualPassword !== manualConfirm;
  const manualSc = STRENGTH_COLORS[manualStrength.color];

  useEffect(() => {
    base44.entities.User.list("-created_date", 100)
      .then((data) => { setUsers(data || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail) return;
    if (inviteMode === "manual" && (!manualValidation.valid || manualPassword !== manualConfirm)) return;
    setInviting(true);
    try {
      const platformRole = ["super_admin", "org_admin"].includes(inviteRole) ? "admin" : "user";
      await base44.users.inviteUser(inviteEmail, platformRole);
      try {
        const found = await base44.entities.User.filter({ email: inviteEmail });
        if (found.length > 0 && found[0].id) {
          await base44.entities.User.update(found[0].id, {
            raviqen_role: inviteRole,
            ...(inviteMode === "manual" ? { requires_reset: true } : {})
          });
        }
      } catch (e2) { /* user may not exist yet */ }
      const actionDetail = inviteMode === "manual"
        ? `Invited ${inviteEmail} as ${ROLES[inviteRole]?.label} (manual password set by admin${requireManualChange ? ", force-change-on-login" : ""})`
        : `Invited ${inviteEmail} as ${ROLES[inviteRole]?.label}`;
      await logCredentialEvent(currentUser, inviteMode === "manual" ? "manual_account_created" : "invitation_sent", "", inviteEmail, actionDetail);

      // Send credential email with plain-text password for manual mode
      if (inviteMode === "manual") {
        try {
          const loginUrl = window.location.origin + "/login";
          await base44.integrations.Core.SendEmail({
            to: inviteEmail,
            subject: "Your RAVIQEN Account Credentials",
            body: `Welcome to RAVIQEN.\n\nYour account has been created by an administrator with the following credentials:\n\nEmail: ${inviteEmail}\nPassword: ${manualPassword}\n\nLogin link: ${loginUrl}\n\nSECURITY NOTICE: You will be required to change this password upon your first login.\n\nIf you did not expect this account, please contact your administrator immediately.`
          });
        } catch (emailErr) { /* email send failure is non-critical */ }
      }
      toast({
        title: inviteMode === "manual" ? "User account created" : "Invitation sent",
        description: inviteMode === "manual"
          ? `${inviteEmail} has been created as ${ROLES[inviteRole]?.label}. A secure link was sent to confirm their credential.`
          : `${inviteEmail} has been invited as ${ROLES[inviteRole]?.label}. They will set their own password via the secure invitation link.`,
      });
      setInviteEmail("");
      setManualPassword("");
      setManualConfirm("");
      setRequireManualChange(true);
      const refreshed = await base44.entities.User.list("-created_date", 100);
      setUsers(refreshed || []);
    } catch (err) {
      toast({ title: "Error", description: err.message || "Failed to invite user", variant: "destructive" });
    } finally {
      setInviting(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      await logCredentialEvent(currentUser, "credentials_revoked", revokeTarget.id, revokeTarget.email, `Credentials revoked by admin`);
      toast({ title: "Credentials revoked", description: `${revokeTarget.email}'s access has been flagged for revocation. The user will need to be re-invited to regain access.` });
      setRevokeTarget(null);
    } catch (err) {
      toast({ title: "Error", description: err.message || "Failed to revoke credentials", variant: "destructive" });
    } finally {
      setRevoking(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    const platformRole = ["super_admin", "org_admin"].includes(newRole) ? "admin" : "user";
    try {
      await base44.entities.User.update(userId, { raviqen_role: newRole, role: platformRole });
      const targetUser = users.find((u) => u.id === userId);
      await logCredentialEvent(currentUser, "role_change", userId, targetUser?.email, `Role changed to ${ROLES[newRole]?.label}`);
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, raviqen_role: newRole, role: platformRole } : u)));
      toast({ title: "Role updated", description: `User is now ${ROLES[newRole]?.label}.` });
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleResetPassword = async (targetUser) => {
    setResettingId(targetUser.id);
    try {
      // Trigger platform password reset email — user sets their own new password
      await base44.auth.resetPasswordRequest(targetUser.email);
      await logCredentialEvent(currentUser, "password_reset", targetUser.id, targetUser.email, `Force password reset triggered by admin`);
      toast({ title: "Password reset sent", description: `${targetUser.email} will receive a secure link to set a new password.` });
    } catch (err) {
      toast({ title: "Error", description: err.message || "Failed to send reset email", variant: "destructive" });
    } finally {
      setResettingId(null);
    }
  };

  const getInitials = (name) => (name || "U").split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();
  const myRole = normalizeUserRole(currentUser);
  const canManage = isAdminRole(myRole);
  const canManageCreds = canManageCredentials(myRole);

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-slate-200 px-4 md:px-8 py-4 sticky top-0 z-10">
        <h1 className="text-lg font-bold text-[#231F20]">Team & Users</h1>
        <p className="text-xs text-slate-500">Manage team members and role assignments</p>
      </header>

      <div className="p-4 md:p-8 max-w-4xl space-y-5">
        {/* Credential Administration Policy Banner */}
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center shrink-0">
              {canManageCreds ? <KeyRound className="w-4.5 h-4.5 text-white" /> : <Lock className="w-4.5 h-4.5 text-white" />}
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-[#231F20] flex items-center gap-2">
                Password Administration Policy
                {canManageCreds ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-medium">
                    <Shield className="w-3 h-3" /> Admin Access
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-medium">
                    <Lock className="w-3 h-3" /> Invitation Only
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {canManageCreds
                  ? "As a Super Admin or Organisation Admin, you can create, assign, override, and reset passwords for team members. All credential actions are logged with your admin ID, timestamp, target user, and IP address."
                  : "Your role does not permit password creation or resets. New team members are onboarded via secure email invitation links, allowing them to set their own passwords. Only Super Admin and Organisation Admin can manage credentials directly."}
              </p>
            </div>
          </div>
        </div>

        {canManage && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center"><UserPlus className="w-5 h-5 text-slate-600" /></div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-[#231F20]">Invite Team Member</h3>
                <p className="text-xs text-slate-500">{inviteMode === "link" ? "Send a secure invitation link — the recipient sets their own password" : "Set password manually — admin creates the credential directly"}</p>
              </div>
            </div>
            {/* Mode toggle */}
            <div className="flex gap-2 mb-4 p-1 bg-slate-50 rounded-lg border border-slate-100">
              <button
                type="button"
                onClick={() => setInviteMode("link")}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${inviteMode === "link" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                <Mail className="w-3.5 h-3.5" /> Send Invitation Link
              </button>
              <button
                type="button"
                onClick={() => setInviteMode("manual")}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${inviteMode === "manual" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                <KeyRound className="w-3.5 h-3.5" /> Set Password Manually
              </button>
            </div>
            <form onSubmit={handleInvite} className="space-y-2">
              <div className="flex flex-col sm:flex-row gap-2">
                <input type="email" placeholder="email@example.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required className="flex-1 text-sm px-3 py-2 rounded-lg border border-slate-200 focus:border-slate-400 focus:ring-1 focus:ring-slate-300 outline-none" />
                <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className="text-sm px-3 py-2 rounded-lg border border-slate-200 outline-none bg-white">
                  {Object.entries(ROLES).map(([key, r]) => <option key={key} value={key}>{r.label}</option>)}
                </select>
              </div>
              {inviteMode === "manual" && (
                <div className="space-y-2 pt-1">
                  <div>
                    <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide mb-1 block">Password</label>
                    <div className="relative">
                      <input
                        type={showManualPw ? "text" : "password"}
                        value={manualPassword}
                        onChange={(e) => setManualPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full text-sm px-3 py-2 pr-9 rounded-lg border border-slate-200 focus:border-slate-400 focus:ring-1 focus:ring-slate-300 outline-none"
                      />
                      <button type="button" onClick={() => setShowManualPw(!showManualPw)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        {showManualPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {manualPassword.length > 0 && (
                      <div className="mt-1 flex items-center gap-2">
                        <div className="flex-1 h-1 rounded-full bg-slate-100 overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${manualSc.bg} ${manualStrength.bar}`} />
                        </div>
                        <span className={`text-[10px] font-medium ${manualSc.text}`}>{manualStrength.label}</span>
                      </div>
                    )}
                    {manualPassword.length > 0 && !manualValidation.valid && (
                      <ul className="mt-1 space-y-0.5">
                        {manualValidation.errors.map((err, i) => (
                          <li key={i} className="text-[10px] text-red-500 flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" /> {err}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide mb-1 block">Confirm Password</label>
                    <input
                      type={showManualPw ? "text" : "password"}
                      value={manualConfirm}
                      onChange={(e) => setManualConfirm(e.target.value)}
                      placeholder="••••••••"
                      className={`w-full text-sm px-3 py-2 rounded-lg border outline-none ${manualMatchError ? "border-red-300" : manualConfirm.length > 0 && !manualMatchError ? "border-emerald-300" : "border-slate-200 focus:border-slate-400 focus:ring-1 focus:ring-slate-300"}`}
                    />
                    {manualMatchError && <p className="mt-1 text-[10px] text-red-500">Passwords do not match</p>}
                  </div>
                  <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100 cursor-pointer">
                    <input type="checkbox" checked={requireManualChange} onChange={(e) => setRequireManualChange(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400" />
                    <span className="text-xs text-slate-600">Require user to change password on first login</span>
                  </label>
                </div>
              )}
              <button
                type="submit"
                disabled={inviting || (inviteMode === "manual" && (!manualValidation.valid || manualPassword !== manualConfirm || !manualConfirm))}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors w-full sm:w-auto"
              >
                {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : inviteMode === "manual" ? <KeyRound className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
                {inviting ? "Processing…" : inviteMode === "manual" ? "Create User Account" : "Invite"}
              </button>
            </form>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3">Member</th>
                    <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3">Email</th>
                    <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3">Role</th>
                    <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3">Credentials</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => {
                    const role = normalizeUserRole(u);
                    const isMe = u.id === currentUser?.id;
                    return (
                      <tr key={u.id} className="hover:bg-slate-50/60">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-900 flex items-center justify-center text-white text-xs font-semibold">{getInitials(u.full_name || u.email)}</div>
                            <span className="text-sm font-medium text-[#231F20]">{u.full_name || (u.email ? u.email.split("@")[0] : "User")}{isMe && <span className="text-xs text-slate-400 ml-1">(You)</span>}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">{u.email}</td>
                        <td className="px-4 py-3">
                          {canManage && !isMe ? (
                            <select value={role} onChange={(e) => handleRoleChange(u.id, e.target.value)} className="text-xs px-2 py-1.5 rounded-lg border border-slate-200 outline-none bg-white">
                              {Object.entries(ROLES).map(([key, r]) => <option key={key} value={key}>{r.label}</option>)}
                            </select>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
                              <Shield className="w-3 h-3" /> {ROLES[role]?.label || "User"}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {canManageCreds && !isMe ? (
                            <CredentialActionsMenu
                              onSetPassword={() => setResetPwTarget(u)}
                              onRevoke={() => setRevokeTarget(u)}
                            />
                          ) : isMe ? (
                            <span className="text-xs text-slate-400 italic">Self-managed</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-50 text-slate-400 text-[11px] font-medium border border-slate-200">
                              <Lock className="w-3 h-3" /> Admin only
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {users.length === 0 && <p className="text-center text-sm text-slate-400 py-12">No team members found</p>}
          </div>
        )}
      </div>

      {createPwTarget && (
        <CreatePasswordModal
          target={createPwTarget}
          onClose={() => setCreatePwTarget(null)}
          isAdmin={canManageCreds}
          isHighPrivilege={isAdminRole(normalizeUserRole(createPwTarget))}
          adminUser={currentUser}
          mode="create"
        />
      )}

      {resetPwTarget && (
        <CreatePasswordModal
          target={resetPwTarget}
          onClose={() => setResetPwTarget(null)}
          isAdmin={canManageCreds}
          isHighPrivilege={isAdminRole(normalizeUserRole(resetPwTarget))}
          adminUser={currentUser}
          mode="reset"
        />
      )}

      {revokeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setRevokeTarget(null)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#231F20]">Revoke Credentials?</h3>
                <p className="text-xs text-slate-500">{revokeTarget.email}</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 mb-4">
              This will flag <span className="font-medium">{revokeTarget.full_name || revokeTarget.email}</span>'s credentials for revocation. The user will lose platform access and must be re-invited to regain entry. This action is logged in the audit trail.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setRevokeTarget(null)} disabled={revoking} className="flex-1 px-4 py-2 rounded-lg border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 disabled:opacity-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleRevoke} disabled={revoking} className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors">
                {revoking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserX className="w-3.5 h-3.5" />}
                {revoking ? "Revoking…" : "Revoke Access"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}