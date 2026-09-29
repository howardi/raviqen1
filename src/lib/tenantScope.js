// Client-side multi-tenant helpers.
// Stamp tenant_id onto payloads created by the logged-in user, and build
// tenant-scoped filters for client-side entity queries.

// Returns the current user's tenant (organization) id, or null if unprovisioned.
export function getUserTenantId(user) {
  return user?.tenant_id || user?.data?.tenant_id || null;
}

// True for global Super Admin (not scoped to any tenant).
export function isSuperAdmin(user) {
  const role = user?.raviqen_role || user?.role;
  return role === "super_admin";
}

// Stamp tenant_id onto a create payload. No-op for Super Admin (global) or
// unprovisioned users, so existing flows keep working during the migration.
export function stampTenant(payload, user) {
  const tid = getUserTenantId(user);
  if (tid && !payload?.tenant_id) {
    return { ...payload, tenant_id: tid };
  }
  return payload || {};
}

// Build a tenant filter for client-side entity queries (e.g. filter()).
// Super Admin / unprovisioned users get no filter (RLS still applies server-side).
export function tenantFilter(user) {
  if (isSuperAdmin(user)) return {};
  const tid = getUserTenantId(user);
  return tid ? { tenant_id: tid } : {};
}