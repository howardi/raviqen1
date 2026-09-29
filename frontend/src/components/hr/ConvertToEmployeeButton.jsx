import React, { useState } from "react";
import { UserPlus, Loader2, CheckCircle2, Mail, Lock, KeyRound } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { convertCandidateToEmployee } from "@/lib/employeeIngestion";
import { useAuth } from "@/lib/AuthContext";
import { canManageCredentials, normalizeUserRole, ROLES } from "@/lib/permissions";
import { logCredentialEvent } from "@/lib/activityLogger";

export default function ConvertToEmployeeButton({ check, onConverted }) {
  const { user: currentUser } = useAuth();
  const myRole = normalizeUserRole(currentUser);
  const canManageCreds = canManageCredentials(myRole);

  const [converting, setConverting] = useState(false);
  const [converted, setConverted] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);

  if (check.overall_status !== "cleared") return null;

  const handleConvert = async () => {
    setConverting(true);
    try {
      const employee = await convertCandidateToEmployee(check, currentUser);
      setConverted(true);
      if (onConverted) onConverted(employee);
    } catch (e) {
      console.error(e);
    }
    setConverting(false);
  };

  const handleSendInvitation = async () => {
    if (!inviteEmail) return;
    setInviting(true);
    try {
      // Send secure invitation — recipient sets their own password
      await base44.users.inviteUser(inviteEmail, "user");
      await logCredentialEvent(
        currentUser,
        "invitation_sent",
        "",
        inviteEmail,
        `Employee onboarding invitation for ${check.candidate_name} (${check.position_applied || "new hire"})`
      );
      setInviteSent(true);
    } catch (e) {
      console.error(e);
    }
    setInviting(false);
  };

  if (converted) {
    return (
      <div className="px-4 pb-4 space-y-3">
        <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <p className="text-xs text-emerald-700 font-medium">Candidate converted to active employee</p>
        </div>
        {!inviteSent && (
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <div className="flex items-start gap-2 mb-2">
              {canManageCreds ? <KeyRound className="w-4 h-4 text-slate-600 mt-0.5" /> : <Mail className="w-4 h-4 text-slate-600 mt-0.5" />}
              <p className="text-xs text-slate-600">
                {canManageCreds
                  ? "Create a login account for this employee. They will receive a secure link to set their own password."
                  : "Send a secure invitation link so this employee can set up their own login and password."}
              </p>
            </div>
            {!showInvite ? (
              <button
                onClick={() => setShowInvite(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 transition-colors"
              >
                {canManageCreds ? <KeyRound className="w-3.5 h-3.5" /> : <Mail className="w-3.5 h-3.5" />}
                {canManageCreds ? "Create Login Account" : "Send Invitation Link"}
              </button>
            ) : inviteSent ? (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <p className="text-xs text-emerald-700 font-medium">Invitation sent to {inviteEmail}</p>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="email"
                  placeholder="employee@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="flex-1 text-xs px-3 py-1.5 rounded-lg border border-slate-200 focus:border-slate-400 focus:ring-1 focus:ring-slate-300 outline-none"
                />
                <button
                  onClick={handleSendInvitation}
                  disabled={inviting || !inviteEmail}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
                >
                  {inviting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                  {inviting ? "Sending…" : "Send"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="px-4 pb-4">
      {!canManageCreds && (
        <div className="flex items-center gap-1.5 mb-2 p-2 rounded-lg bg-amber-50 border border-amber-200">
          <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <p className="text-[11px] text-amber-700">
            Your role ({ROLES[myRole]?.label}) cannot create passwords. Onboarding uses a secure email invitation link.
          </p>
        </div>
      )}
      <button
        onClick={handleConvert}
        disabled={converting}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 text-white text-xs font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors w-full justify-center"
      >
        {converting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
        {converting ? "Converting…" : "Convert Candidate to Active Employee"}
      </button>
    </div>
  );
}