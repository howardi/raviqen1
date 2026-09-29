import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';

// Admin emails that get auto-elevated to Super Admin on signup are read from the
// ADMIN_BOOTSTRAP_EMAILS secret — never from a hardcoded source value.

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { user_id } = body;

    if (!user_id) {
      return Response.json({ error: "Missing user_id" }, { status: 400 });
    }

    // Fetch the actual user record — don't trust the email from the request body.
    const user = await base44.asServiceRole.entities.User.get(user_id);
    if (!user || !user.email) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const email = String(user.email).toLowerCase();

    // Build admin email list from the ADMIN_BOOTSTRAP_EMAILS secret only.
    const adminSecret = secrets.get("ADMIN_BOOTSTRAP_EMAILS");
    const adminEmails = new Set(
      adminSecret ? adminSecret.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean) : []
    );

    // Check for an organization member invitation by email — if the user was
    // invited to an org with a specific role, preserve that role instead of
    // defaulting to "pending".
    let orgMemberRole = null;
    try {
      const memberRecords = await base44.asServiceRole.entities.OrganizationMember.filter({
        user_email: email,
      });
      if (memberRecords && memberRecords.length > 0) {
        // Only honor admin-created invitations (invited_by set, not suspended) so
        // a caller cannot influence the assigned role via self-created records.
        const validInvite = memberRecords.find(
          (m) => m.invited_by && m.role && m.role !== "pending" && m.status !== "suspended"
        );
        orgMemberRole = validInvite?.role || null;
      }
    } catch (e) {
      // OrganizationMember query might fail — non-critical, fall through
    }

    // Determine target role: admin emails take top priority, then org member
    // invitation role, then default "pending".
    let targetRole: string;
    let roleSource: string;
    if (adminEmails.has(email)) {
      targetRole = "super_admin";
      roleSource = "admin_bootstrap";
    } else if (orgMemberRole && orgMemberRole !== "pending") {
      targetRole = orgMemberRole;
      roleSource = "org_member_invitation";
    } else {
      targetRole = "pending";
      roleSource = "default";
    }

    // Only update if the role actually needs changing
    if (user.role !== targetRole || user.raviqen_role !== targetRole) {
      const updateData: Record<string, unknown> = {
        role: targetRole,
        raviqen_role: targetRole,
      };

      // When auto-activating from an org invitation (non-pending role),
      // grant default module access if the user has no feature flags yet.
      if (targetRole !== "pending") {
        const hasFlags =
          user.feature_flags &&
          typeof user.feature_flags === "object" &&
          Object.keys(user.feature_flags).length > 0;
        if (!hasFlags) {
          updateData.feature_flags = {
            data_ingestion: true, investigations: true, alerts: true,
            case_management: true, sanctions_screening: true, network_explorer: true,
            ingestion_screening: true, entity_intelligence: true, autonomous_engine: true,
            analytics: true, collusion_detector: true, what_if_sandbox: true,
            insider_threat: true, crypto_audit: true, osint_scanner: true,
            vendor_verification: true, fx_stress_test: true, regulatory_horizon: true,
            reports_exports: true, risk_rules: true, daily_reports: true,
            hr_dashboard: true, activity_stream: true, relief_calendar: true,
            resource_calculator: true, integrations: true, audit_log: true,
            ai_chatbox: true, support: true, settings: true,
            raviqen_oversight: true, staff_ai_chatbox: false,
          };
        }
      }

      // Guided onboarding: when a default pending user signs up and the
      // platform is in guided mode, mark their account as pending_setup
      // so they're routed to the onboarding flow instead of the dashboard.
      if (targetRole === "pending") {
        try {
          const settings = await base44.asServiceRole.entities.PlatformSetting.list();
          const mode = settings && settings[0] && settings[0].onboarding_mode;
          if (mode === "guided") {
            updateData.account_status = "pending_setup";
          }
        } catch (e) { /* PlatformSetting query may fail — non-critical */ }
      }

      await base44.asServiceRole.entities.User.update(user_id, updateData);
    }

    return Response.json({
      success: true,
      user_id,
      email,
      assigned_role: targetRole,
      role_source: roleSource,
      elevated: targetRole === "super_admin",
      activated: targetRole !== "pending",
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}