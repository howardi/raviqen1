import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";
import { ROLES, normalizeUserRole, isAdminRole } from "@/lib/permissions";
import { logActivity } from "@/lib/activityLogger";
import { Search, Loader2, Shield, Users, Lock, UserCheck, Ban, Building2 } from "lucide-react";
import UserEditModal from "@/components/admin/UserEditModal";
import UserActionsMenu from "@/components/admin/UserActionsMenu";
import CreatePasswordModal from "@/components/CreatePasswordModal";
import BackToTop from "@/components/BackToTop";
import { DEFAULT_FEATURE_FLAGS } from "@/lib/defaultFlags";
import { canManageCredentials } from "@/lib/permissions";

export default function AdminUsers() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [editTarget, setEditTarget] = useState(null);
  const [passwordTarget, setPasswordTarget] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const [userData, orgData, memberData] = await Promise.all([
        base44.entities.User.list("-created_date", 200),
        base44.entities.Organization.list("-created_date", 200).catch(() => []),
        base44.entities.OrganizationMember.list("-created_date", 200).catch(() => []),
      ]);
      setUsers(userData || []);
      setOrgs(orgData || []);
      setMembers(memberData || []);
    } catch (e) {
      toast({ title: "Error", description: "Failed to load users", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Resolve the organization (id + name) a user belongs to, from either their
  // OrganizationMember record or their tenant_id.
  const getOrgForUser = (u) => {
    if (!u) return { id: null, name: null };
    const member = members.find(
      (m) => m.user_id === u.id || (m.user_email && u.email && m.user_email.toLowerCase() === String(u.email).toLowerCase())
    );
    if (member) {
      const name = member.organization_name || orgs.find((o) => o.id === member.organization_id)?.name;
      return { id: member.organization_id, name };
    }
    if (u.tenant_id) {
      const org = orgs.find((o) => o.id === u.tenant_id);
      if (org) return { id: org.id, name: org.name };
      return { id: u.tenant_id, name: u.tenant_id };
    }
    return { id: null, name: null };
  };

  const getUserStatus = (u) => {
    if (u.account_status === "disabled") return "disabled";
    // A user trapped in guided onboarding (pending_setup) is still pending,
    // even if their role has already been elevated (e.g. super_admin).
    if (u.account_status === "pending_setup" || normalizeUserRole(u) === "pending") return "pending";
    return "active";
  };

  const filteredUsers = users.filter((u) => {
    // Status filter
    if (statusFilter !== "all" && getUserStatus(u) !== statusFilter) return false;
    // Search filter
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const name = (u.full_name || "").toLowerCase();
    const email = (u.email || "").toLowerCase();
    const role = normalizeUserRole(u);
    const roleLabel = (ROLES[role]?.label || "").toLowerCase();
    return name.includes(q) || email.includes(q) || roleLabel.includes(q);
  });

  const handleResetPassword = (user) => {
    setPasswordTarget(user);
  };

  const handleToggleDisable = async (user) => {
    setActionLoading(user.id);
    try {
      const isDisabled = user.account_status === "disabled";
      const newStatus = isDisabled ? "active" : "disabled";
      await base44.entities.User.update(user.id, { account_status: newStatus });
      await logActivity(currentUser, "admin_user_toggle_disable", `${isDisabled ? "Enabled" : "Disabled"} ${user.email}: status → ${newStatus}`);
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, account_status: newStatus } : u)));
      toast({
        title: isDisabled ? "User enabled" : "User disabled",
        description: `${user.email} has been ${isDisabled ? "enabled" : "disabled"} and can ${isDisabled ? "now" : "no longer"} log in.`,
        variant: isDisabled ? "default" : "destructive",
      });
    } catch (err) {
      toast({ title: "Error", description: err.message || "Failed to update user status", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteUser = async (user) => {
    setActionLoading(user.id);
    try {
      await base44.entities.User.delete(user.id);
      await logActivity(currentUser, "admin_user_delete", `Deleted user ${user.email}`);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      toast({ title: "User deleted", description: `${user.email} has been permanently removed.`, variant: "destructive" });
    } catch (err) {
      toast({ title: "Delete failed", description: err.message || "Failed to delete user", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const getInitials = (name) => (name || "U").split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();

  const handleEditSave = async (userId, newRole, featureFlags, orgId, department) => {
    try {
      const targetUser = users.find((u) => u.id === userId);
      const oldRole = normalizeUserRole(targetUser);
      const wasPending = oldRole === "pending";
      const isNowActive = newRole !== "pending";

      // Auto-activation: when assigning a functional role to a Pending user,
      // grant default module access if the admin hasn't explicitly enabled any flags.
      let finalFlags = featureFlags;
      if (wasPending && isNowActive && Object.values(featureFlags).filter(Boolean).length === 0) {
        finalFlags = DEFAULT_FEATURE_FLAGS;
      }

      const platformRole = ["super_admin", "org_admin", "company_admin"].includes(newRole) ? "admin" : "user";
      // When activating a pending user (assigning a real role), also clear the
      // pending_setup flag so they are no longer redirected to guided onboarding.
      const updatePayload = {
        raviqen_role: newRole,
        role: platformRole,
        feature_flags: finalFlags,
        department,
      };
      // Activating: assigning a real (non-pending) role unlocks the account.
      // Clear any pending_setup status (which traps the user on guided
      // onboarding) and ensure account_status is "active". Don't override a
      // "disabled" status — that's managed by the disable toggle.
      if (isNowActive && targetUser.account_status !== "disabled") {
        updatePayload.account_status = "active";
      }

      // Update organization assignment if it changed. tenant_id is the
      // multi-tenant isolation key, so keeping it in sync is critical.
      const currentOrg = getOrgForUser(targetUser);
      const orgChanged = orgId && orgId !== currentOrg.id;
      if (orgChanged) {
        updatePayload.tenant_id = orgId;
      }

      await base44.entities.User.update(userId, updatePayload);

      // Upsert the OrganizationMember record so membership is tracked
      // alongside the tenant_id.
      if (orgChanged) {
        const org = orgs.find((o) => o.id === orgId);
        const existingMember = members.find(
          (m) => m.user_id === userId || (m.user_email && targetUser.email && m.user_email.toLowerCase() === String(targetUser.email).toLowerCase())
        );
        try {
          if (existingMember) {
            await base44.entities.OrganizationMember.update(existingMember.id, {
              organization_id: orgId,
              organization_name: org?.name || "",
              role: newRole,
              status: "active",
              user_id: userId,
            });
          } else {
            await base44.entities.OrganizationMember.create({
              organization_id: orgId,
              organization_name: org?.name || "",
              user_id: userId,
              user_email: targetUser.email,
              user_name: targetUser.full_name || "",
              role: newRole,
              status: "active",
              invited_by: currentUser?.id,
            });
          }
        } catch (_memberErr) {
          // Non-critical — tenant_id is the source of truth for data isolation.
        }
      }

      const orgLogMsg = orgChanged ? `, org → ${orgs.find((o) => o.id === orgId)?.name || orgId}` : "";
      await logActivity(currentUser, "admin_user_role_update", `Updated ${targetUser?.email || userId}: role → ${ROLES[newRole]?.label}${orgLogMsg}`);
      const wasLocked = targetUser.account_status === "pending_setup" || oldRole === "pending";
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, raviqen_role: newRole, role: platformRole, feature_flags: finalFlags, department, ...((isNowActive && targetUser.account_status !== "disabled") ? { account_status: "active" } : {}), ...(orgChanged ? { tenant_id: orgId } : {}) } : u)));
      // Refresh members so the Organization column updates immediately.
      try {
        const refreshedMembers = await base44.entities.OrganizationMember.list("-created_date", 200);
        setMembers(refreshedMembers || []);
      } catch (_e) { /* non-critical */ }
      const activatedMsg = isNowActive && wasLocked ? " — account activated" : "";
      toast({ title: "Permissions updated", description: `${targetUser?.email} is now ${ROLES[newRole]?.label}${activatedMsg}.` });
      setEditTarget(null);
    } catch (err) {
      toast({ title: "Error", description: err.message || "Failed to update user", variant: "destructive" });
    }
  };

  const [activatingId, setActivatingId] = useState(null);

  const handleActivate = async (userId) => {
    setActivatingId(userId);
    try {
      const res = await base44.functions.invoke("activateUser", { user_id: userId });
      const targetUser = users.find((u) => u.id === userId);
      const assignedRole = res.assigned_role || "member";
      const platformRole = ["super_admin", "org_admin", "company_admin"].includes(assignedRole) ? "admin" : "user";
      await logActivity(currentUser, "admin_user_activate", `Activated ${targetUser?.email || userId}: role → ${ROLES[assignedRole]?.label || assignedRole}`);
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, raviqen_role: assignedRole, role: platformRole, feature_flags: DEFAULT_FEATURE_FLAGS, account_status: "active" } : u)));
      toast({ title: "Account activated", description: `${targetUser?.email} is now ${ROLES[assignedRole]?.label || "Active"} with default module access.` });
    } catch (err) {
      toast({ title: "Activation failed", description: err.message || "Failed to activate user", variant: "destructive" });
    } finally {
      setActivatingId(null);
    }
  };

  const myRole = normalizeUserRole(currentUser);
  const canManage = isAdminRole(myRole);

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-slate-200 px-4 md:px-8 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-[#231F20]">User Management</h1>
            <p className="text-xs text-slate-500">Manage roles, permissions, and feature access for all users</p>
          </div>
        </div>
      </header>

      <div className="p-4 md:p-8 max-w-6xl space-y-5">
        {/* Search bar + status filter tabs */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, email, or role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 text-sm outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300"
            />
          </div>
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg p-1">
            {[
              { key: "all", label: "All", count: users.length },
              { key: "active", label: "Active", count: users.filter((u) => getUserStatus(u) === "active").length },
              { key: "pending", label: "Pending", count: users.filter((u) => getUserStatus(u) === "pending").length },
              { key: "disabled", label: "Disabled", count: users.filter((u) => getUserStatus(u) === "disabled").length },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  statusFilter === tab.key
                    ? "bg-slate-900 text-white"
                    : "text-slate-500 hover:bg-slate-50"
                }`}
              >
                {tab.label}
                <span className={`text-[10px] ${statusFilter === tab.key ? "text-slate-300" : "text-slate-400"}`}>{tab.count}</span>
              </button>
            ))}
          </div>
        </div>

        {/* User table */}
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3">Name</th>
                    <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3">Email</th>
                    <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3">Assigned Role</th>
                    <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3">Organization</th>
                    <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3">Status</th>
                    <th className="text-right text-xs font-semibold text-slate-600 px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map((u) => {
                    const role = normalizeUserRole(u);
                    const userStatus = getUserStatus(u);
                    const isPending = userStatus === "pending";
                    const isDisabled = userStatus === "disabled";
                    const isMe = u.id === currentUser?.id;
                    const roleColor = ROLES[role]?.color || "slate";
                    const org = getOrgForUser(u);
                    const ROLE_BADGE = {
                      red: "bg-red-100 text-red-700", orange: "bg-orange-100 text-orange-700",
                      amber: "bg-amber-100 text-amber-700", green: "bg-emerald-100 text-emerald-700",
                      blue: "bg-blue-100 text-blue-700", violet: "bg-violet-100 text-violet-700",
                      teal: "bg-teal-100 text-teal-700", cyan: "bg-cyan-100 text-cyan-700",
                      slate: "bg-slate-100 text-slate-600",
                    };
                    return (
                      <tr key={u.id} className={`hover:bg-slate-50/60 ${isDisabled ? "opacity-60" : ""}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-900 flex items-center justify-center text-white text-xs font-semibold shrink-0">
                              {getInitials(u.full_name || u.email)}
                            </div>
                            <span className="text-sm font-medium text-[#231F20]">
                              {u.full_name || (u.email ? u.email.split("@")[0] : "User")}
                              {isMe && <span className="text-xs text-slate-400 ml-1">(You)</span>}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">{u.email}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE[roleColor] || ROLE_BADGE.slate}`}>
                            <Shield className="w-3 h-3" /> {ROLES[role]?.label || "User"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {org.name ? (
                            <span className="inline-flex items-center gap-1.5 text-xs text-slate-700">
                              <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate max-w-[160px]">{org.name}</span>
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Unassigned</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {isDisabled ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-xs font-medium border border-red-200">
                              <Ban className="w-3 h-3" /> Disabled
                            </span>
                          ) : isPending ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 text-xs font-medium border border-amber-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Pending
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-xs font-medium border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Active
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {actionLoading === u.id && <Loader2 className="w-3 h-3 animate-spin text-slate-400" />}
                            {canManage && !isMe && isPending && (
                              <button
                                onClick={() => handleActivate(u.id)}
                                disabled={activatingId === u.id}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                              >
                                {activatingId === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserCheck className="w-3 h-3" />}
                                {activatingId === u.id ? "Activating..." : "Approve & Activate"}
                              </button>
                            )}
                            {canManage && !isMe ? (
                              <UserActionsMenu
                                isDisabled={isDisabled}
                                disabled={actionLoading === u.id}
                                onEdit={() => setEditTarget(u)}
                                onResetPassword={() => handleResetPassword(u)}
                                onToggleDisable={() => handleToggleDisable(u)}
                                onDelete={() => handleDeleteUser(u)}
                              />
                            ) : isMe ? (
                              <span className="text-xs text-slate-400 italic">Self-managed</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-50 text-slate-400 text-[11px] font-medium border border-slate-200">
                                <Lock className="w-3 h-3" /> Admin only
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filteredUsers.length === 0 && (
              <p className="text-center text-sm text-slate-400 py-12">
                {searchQuery ? "No users match your search" : "No users found"}
              </p>
            )}
          </div>
        )}

        {/* Summary stats */}
        {!loading && users.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-white rounded-lg border border-slate-200 p-3">
              <p className="text-2xl font-bold text-slate-800">{users.length}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">Total Users</p>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 p-3">
              <p className="text-2xl font-bold text-emerald-600">{users.filter((u) => getUserStatus(u) === "active").length}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">Active</p>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 p-3">
              <p className="text-2xl font-bold text-amber-600">{users.filter((u) => getUserStatus(u) === "pending").length}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">Pending</p>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 p-3">
              <p className="text-2xl font-bold text-red-600">{users.filter((u) => getUserStatus(u) === "disabled").length}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">Disabled</p>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 p-3">
              <p className="text-2xl font-bold text-slate-800">{users.filter((u) => isAdminRole(normalizeUserRole(u))).length}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">Admins</p>
            </div>
          </div>
        )}
      </div>

      {editTarget && (
        <UserEditModal
          user={editTarget}
          orgs={orgs}
          currentOrgId={getOrgForUser(editTarget)?.id}
          onClose={() => setEditTarget(null)}
          onSave={handleEditSave}
        />
      )}

      {passwordTarget && (
        <CreatePasswordModal
          target={passwordTarget}
          onClose={() => setPasswordTarget(null)}
          isAdmin={canManageCredentials(myRole)}
          isHighPrivilege={isAdminRole(normalizeUserRole(passwordTarget))}
          adminUser={currentUser}
          mode="reset"
        />
      )}

      <BackToTop />
    </div>
  );
}