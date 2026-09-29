import { base44 } from "@/api/base44Client";
import { stampTenant } from "@/lib/tenantScope";

export async function logActivity(user, action, detail, entityType = "", entityId = "") {
  try {
    await base44.entities.AuditLogEntry.create(stampTenant({
      user: user?.full_name || user?.email || "Unknown",
      action,
      entity_type: entityType,
      entity_id: String(entityId || ""),
      detail,
    }, user));
  } catch (e) {
    // Silently fail — don't block user actions
  }
}

// --- Credential Audit Trail ---
// Captures client IP for credential events (password create, reset, role change, invitation)
let _cachedIP = null;

async function getClientIP() {
  if (_cachedIP) return _cachedIP;
  try {
    const res = await fetch("https://api.ipify.org?format=json");
    const data = await res.json();
    _cachedIP = data.ip || "unknown";
  } catch {
    _cachedIP = "unknown";
  }
  return _cachedIP;
}

/**
 * Log a credential-related event (password create, reset, force-reset, invitation, role change).
 * Records admin ID, timestamp, target user ID, and IP address per security policy.
 */
export async function logCredentialEvent(adminUser, action, targetUserId, targetEmail, detail) {
  try {
    const ip = await getClientIP();
    await base44.entities.AuditLogEntry.create(stampTenant({
      user: adminUser?.full_name || adminUser?.email || "Unknown",
      action: `credential_${action}`,
      entity_type: "User",
      entity_id: String(targetUserId || ""),
      detail: `${detail} | Target: ${targetEmail || "N/A"} | Admin ID: ${adminUser?.id || "N/A"} | IP: ${ip}`,
      ip_address: ip,
    }, adminUser));
  } catch (e) {
    // Silently fail — don't block credential operations
  }
}