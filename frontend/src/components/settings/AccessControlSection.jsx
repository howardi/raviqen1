import React, { useMemo } from "react";
import { Shield, Lock, Users, KeyRound, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { ROLES, normalizeUserRole, getRoleColor, NAV_PERMISSIONS, canAccessRoute, canManageCredentials } from "@/lib/permissions";

const ROLE_BADGE_CLASSES = {
  red: "bg-red-100 text-red-700 border-red-200",
  orange: "bg-orange-100 text-orange-700 border-orange-200",
  amber: "bg-amber-100 text-amber-700 border-amber-200",
  green: "bg-emerald-100 text-emerald-700 border-emerald-200",
  blue: "bg-blue-100 text-blue-700 border-blue-200",
  violet: "bg-violet-100 text-violet-700 border-violet-200",
  teal: "bg-teal-100 text-teal-700 border-teal-200",
  cyan: "bg-cyan-100 text-cyan-700 border-cyan-200",
  slate: "bg-slate-100 text-slate-700 border-slate-200",
};

export default function AccessControlSection() {
  const { user } = useAuth();
  const role = normalizeUserRole(user);
  const roleInfo = ROLES[role] || ROLES.standard_user;
  const badgeClass = ROLE_BADGE_CLASSES[getRoleColor(role)] || ROLE_BADGE_CLASSES.slate;

  const accessibleModules = useMemo(() => {
    return Object.keys(NAV_PERMISSIONS).filter((route) => canAccessRoute(route, role));
  }, [role]);

  const totalModules = Object.keys(NAV_PERMISSIONS).length;
  const canManageUsers = canManageCredentials(role);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center shrink-0">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[#231F20]">Access Control & Security</h3>
          <p className="text-xs text-slate-500">Your role determines what you can see and do in RAVIQEN</p>
        </div>
      </div>

      {/* Current Role Badge */}
      <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100 mb-4">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-600 to-slate-900 flex items-center justify-center text-white text-xs font-bold shrink-0">
          {(user?.full_name || user?.email || "U").split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[#231F20] truncate">{user?.full_name || user?.email}</p>
          <p className="text-xs text-slate-400 truncate">{user?.email}</p>
        </div>
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${badgeClass} shrink-0`}>
          <Shield className="w-3 h-3" /> {roleInfo.label}
        </span>
      </div>

      {/* Role Description */}
      <p className="text-xs text-slate-500 mb-4 leading-relaxed">{roleInfo.description}</p>

      {/* RBAC Enforcement Status */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-xs">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <span className="text-slate-600">Route guards active — unauthorized URLs redirect automatically</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <span className="text-slate-600">Navigation filtered by role — hidden modules are invisible</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <span className="text-slate-600">Backend RLS enforced — data access restricted at database level</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {canManageUsers ? (
            <><KeyRound className="w-3.5 h-3.5 text-amber-500 shrink-0" /><span className="text-slate-600">You can manage users and assign roles</span></>
          ) : (
            <><Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" /><span className="text-slate-500">User management restricted to Super Admin</span></>
          )}
        </div>
      </div>

      {/* Module Access Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100">
          <div className="flex items-center gap-1.5 mb-1">
            <Eye className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wide">Accessible</span>
          </div>
          <p className="text-xl font-bold text-emerald-900 tabular-nums">{accessibleModules.length}</p>
          <p className="text-[10px] text-emerald-600">modules available</p>
        </div>
        <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
          <div className="flex items-center gap-1.5 mb-1">
            <EyeOff className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Restricted</span>
          </div>
          <p className="text-xl font-bold text-slate-600 tabular-nums">{totalModules - accessibleModules.length}</p>
          <p className="text-[10px] text-slate-400">modules hidden</p>
        </div>
      </div>

      {/* Super Admin Notice */}
      {!canManageUsers && (
        <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-100 flex items-start gap-2">
          <Users className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-700 leading-relaxed">
            Need access to additional modules? Contact your organization's <span className="font-semibold">Super Admin</span> to request a role change.
          </p>
        </div>
      )}
    </div>
  );
}