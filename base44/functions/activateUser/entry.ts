import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { isSuperAdmin, isTenantAdmin, getTenantId } from "../../shared/tenantAuth.ts";

// Default feature flags — all modules enabled for newly activated users.
const DEFAULT_FEATURE_FLAGS: Record<string, boolean> = {
  data_ingestion: true,
  investigations: true,
  alerts: true,
  case_management: true,
  sanctions_screening: true,
  network_explorer: true,
  ingestion_screening: true,
  entity_intelligence: true,
  autonomous_engine: true,
  analytics: true,
  collusion_detector: true,
  what_if_sandbox: true,
  insider_threat: true,
  crypto_audit: true,
  osint_scanner: true,
  vendor_verification: true,
  fx_stress_test: true,
  regulatory_horizon: true,
  reports_exports: true,
  risk_rules: true,
  daily_reports: true,
  hr_dashboard: true,
  activity_stream: true,
  relief_calendar: true,
  resource_calculator: true,
  integrations: true,
  audit_log: true,
  ai_chatbox: true,
  support: true,
  settings: true,
};

// Map RAVIQEN role to platform role
function platformRoleFor(raviqenRole: string): string {
  return ["super_admin", "org_admin", "company_admin"].includes(raviqenRole) ? "admin" : "user";
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me();
    if (!caller) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Authorization: only admins can activate users. Super Admin can activate
    // anyone; tenant admins can only activate members of their own organization.
    if (!isSuperAdmin(caller) && !isTenantAdmin(caller)) {
      return Response.json({ error: "Only administrators can activate users" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { user_id } = body;

    if (!user_id) {
      return Response.json({ error: "Missing user_id" }, { status: 400 });
    }

    // Fetch the target user record (service role bypasses RLS)
    const targetUser = await base44.asServiceRole.entities.User.get(user_id);
    if (!targetUser || !targetUser.email) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const email = String(targetUser.email).toLowerCase();

    // Fetch the target's organization memberships (service role bypasses RLS).
    let memberRecords: any[] = [];
    try {
      memberRecords = await base44.asServiceRole.entities.OrganizationMember.filter({
        user_email: email,
      });
    } catch (_e) {
      // OrganizationMember query might fail — non-critical, use default role
    }

    // Tenant admins may only activate users who belong to their organization.
    if (!isSuperAdmin(caller)) {
      const callerTenant = getTenantId(caller);
      const inOrg = (memberRecords || []).some((m) => m.organization_id === callerTenant);
      if (!inOrg) {
        return Response.json({ error: "You can only activate users within your organization" }, { status: 403 });
      }
    }

    // Derive the role ONLY from admin-created invitations (invited_by set and
    // not suspended), so a caller cannot influence the role via membership data.
    // If no invitation exists, preserve an already-assigned functional role
    // (e.g. super_admin bootstrapped via ADMIN_BOOTSTRAP_EMAILS) instead of
    // downgrading to "member". Default to "member" only for brand-new users.
    let assignedRole = "member";
    let roleSource = "default";
    const validInvite = (memberRecords || []).find(
      (m) => m.invited_by && m.role && m.role !== "pending" && m.status !== "suspended"
    );
    if (validInvite) {
      assignedRole = validInvite.role;
      roleSource = "org_member_invitation";
    } else if (targetUser.raviqen_role && targetUser.raviqen_role !== "pending") {
      assignedRole = targetUser.raviqen_role;
      roleSource = "existing_role_preserved";
    }

    const platformRole = platformRoleFor(assignedRole);

    // Activate the user: set role + default feature flags and clear any
    // pending_setup / pending status so they are no longer redirected to the
    // guided onboarding page after being approved.
    await base44.asServiceRole.entities.User.update(user_id, {
      raviqen_role: assignedRole,
      role: platformRole,
      feature_flags: DEFAULT_FEATURE_FLAGS,
      account_status: "active",
    });

    // Also update the OrganizationMember status from "invited" to "active" for
    // admin-created invitations only.
    for (const m of memberRecords || []) {
      if (m.status === "invited" && m.invited_by) {
        try {
          await base44.asServiceRole.entities.OrganizationMember.update(m.id, {
            status: "active",
            user_id: user_id,
          });
        } catch (_e) {
          // Non-critical
        }
      }
    }

    return Response.json({
      success: true,
      user_id,
      email,
      assigned_role: assignedRole,
      role_source: roleSource,
      activated: true,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}