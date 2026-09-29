import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { isSuperAdmin } from "../../shared/tenantAuth.ts";
import { getPlanLimits, PLAN_LIMITS } from "../../shared/plans.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { name, description, industry, country, contact_email } = body;

    if (!name || !String(name).trim()) {
      return Response.json({ error: 'Organization name is required' }, { status: 400 });
    }

    // Determine the subscription plan. Only Super Admins can provision a paid
    // tier above Starter; regular users self-provision on the Starter plan so the
    // 4-tier pricing model cannot be bypassed by self-creating an Enterprise org.
    const requestedPlan = body.subscription_plan;
    const plan = isSuperAdmin(user) && requestedPlan && PLAN_LIMITS[requestedPlan]
      ? requestedPlan
      : "starter";
    const limits = getPlanLimits(plan);

    // All module feature flags — enabled by default; the subscription plan still
    // gates which features are actually available (enforced via checkPlanLimits).
    const ALL_FEATURE_FLAGS = {
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
      raviqen_oversight: true,
      staff_ai_chatbox: false,
    };

    // Create the organization via the service role (bypasses RLS) so any
    // authenticated user can provision their own org while the plan and limits
    // are enforced server-side and cannot be client-influenced.
    const org = await base44.asServiceRole.entities.Organization.create({
      name: String(name).trim(),
      description: description || "",
      industry: industry || "",
      country: country || "",
      contact_email: contact_email || user.email,
      owner_id: user.id,
      owner_email: user.email,
      status: "active",
      subscription_plan: plan,
      max_users: limits.max_users ?? 999,
      max_locations: limits.max_locations ?? 1,
      max_transactions_per_month: limits.max_transactions_per_month ?? 5000,
      feature_flags: ALL_FEATURE_FLAGS,
    });

    // Create the creator's membership as company_admin (service role bypasses
    // the admin-only OrganizationMember.create RLS for a brand-new owner).
    await base44.asServiceRole.entities.OrganizationMember.create({
      organization_id: org.id,
      organization_name: org.name,
      user_id: user.id,
      user_email: user.email,
      user_name: user.full_name || user.email,
      role: "company_admin",
      status: "active",
      invited_by: user.id,
    });

    // Elevate the user's global role from pending to company_admin
    const currentRole = user.raviqen_role || user.role;
    if (currentRole === "pending" || currentRole === "user") {
      await base44.asServiceRole.entities.User.update(user.id, {
        role: "company_admin",
        raviqen_role: "company_admin",
      });
    }

    // Provision the owner's tenant_id (= new org id) and backfill existing records.
    try {
      await base44.auth.updateMe({ tenant_id: org.id });
    } catch (e) { /* best-effort; user can self-provision via bootstrapTenant later */ }

    const OPERATIONAL_ENTITIES = [
      "Transaction", "Alert", "Investigation", "EntityProfile",
      "AutonomousScan", "VendorVerification", "DailyReport", "RegulatoryReport",
      "IngestionBatch", "AdverseMediaScan", "CalendarEvent", "SustainabilityAssessment",
      "Employee", "PayrollRecord", "AttendanceRecord", "HRAlert", "BackgroundCheck",
      "RiskRule", "RegulatoryUpdate", "SourceRecord", "AuditLogEntry",
      "RemediationAction", "SupportTicket", "BackupRecord", "UserSession",
    ];
    const backfill = {};
    for (const entityName of OPERATIONAL_ENTITIES) {
      try {
        const entity = base44.asServiceRole.entities[entityName];
        if (!entity || typeof entity.updateMany !== "function") continue;
        const res = await entity.updateMany(
          { created_by_id: user.id, tenant_id: { $exists: false } },
          { $set: { tenant_id: org.id } }
        );
        backfill[entityName] = res?.modifiedCount ?? res?.count ?? null;
      } catch (e) { backfill[entityName] = { error: e.message }; }
    }

    return Response.json({
      success: true,
      organization: org,
      tenant_id: org.id,
      backfill,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}