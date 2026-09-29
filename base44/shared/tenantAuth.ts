// Multi-tenant data scoping + tenant-scoped RBAC helpers.
// The "middleware" equivalent for backend functions: import and call these to
// scope queries to the caller's tenant and enforce tenant-scoped admin authority.
// Import from a backend function:
//   import { isSuperAdmin, tenantScopeFilter, canManageTenant } from "../../shared/tenantAuth.ts";

// Roles that hold admin authority within a single tenant (organization).
const TENANT_ADMIN_ROLES = ["super_admin", "org_admin", "company_admin"];

// Super Admin is global — not scoped to any tenant.
export function isSuperAdmin(user) {
  const role = user?.raviqen_role || user?.role;
  return role === "super_admin";
}

export function isTenantAdmin(user) {
  const role = user?.raviqen_role || user?.role;
  return TENANT_ADMIN_ROLES.includes(role);
}

// The caller's tenant id = their organization id, stored on the user record.
export function getTenantId(user) {
  return user?.tenant_id || user?.data?.tenant_id || null;
}

// Mongo-style filter that scopes a service-role query to the caller's tenant.
// Super Admin receives {} (cross-tenant). Unprovisioned users receive a
// non-matching filter so they cannot read tenant-scoped records until provisioned.
export function tenantScopeFilter(user) {
  if (isSuperAdmin(user)) return {};
  const tid = getTenantId(user);
  if (!tid) return { __no_tenant: true };
  return { tenant_id: tid };
}

// Enforce that an action against a target tenant is allowed for the caller.
// Super Admin = any tenant; tenant admin = own tenant only; everyone else = denied.
export function canManageTenant(user, targetTenantId) {
  if (isSuperAdmin(user)) return true;
  if (!isTenantAdmin(user)) return false;
  if (!targetTenantId) return false;
  return getTenantId(user) === targetTenantId;
}