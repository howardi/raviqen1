import { getTenantId } from "./tenantAuth.ts";

export const OVERSIGHT_MANAGER_ROLES = ["super_admin", "org_admin", "company_admin", "executive"];

export function oversightRole(user) {
  if (user?.raviqen_role) return user.raviqen_role;
  if (user?.role === "admin") return "org_admin";
  return user?.role || "pending";
}

export function isOversightManager(user) {
  return OVERSIGHT_MANAGER_ROLES.includes(oversightRole(user));
}

export function isDisabled(user) {
  return user?.account_status === "disabled";
}

export function assertOversightManager(user) {
  if (!user) return { status: 401, error: "Sign in required." };
  if (isDisabled(user)) return { status: 403, error: "This account is deactivated." };
  if (!isOversightManager(user)) return { status: 403, error: "Manager access required." };
  const tenantId = getTenantId(user);
  if (!tenantId) return { status: 403, error: "Assign an organization before using oversight." };
  return { tenantId };
}

export async function writeOversightAudit(base44, { tenantId, actor, action, entityType, entityId, before, after, ip }) {
  try {
    await base44.asServiceRole.entities.OversightAuditEvent.create({
      tenant_id: tenantId || "",
      actor_id: actor?.id || "",
      actor_email: actor?.email || "",
      action,
      entity_type: entityType || "",
      entity_id: entityId || "",
      ip_address: ip || "",
      before_json: before ? JSON.stringify(before) : "",
      after_json: after ? JSON.stringify(after) : "",
    });
  } catch (_error) {
    // Audit must never fail the business action.
  }
}
