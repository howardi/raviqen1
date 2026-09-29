import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me();
    if (!caller) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify caller is a Super Admin. Only raviqen_role is trustworthy here —
    // the platform `role` field is "admin" for org/company admins too, so checking
    // it would let a tenant admin factory-reset the entire platform.
    if (caller.raviqen_role !== "super_admin") {
      return Response.json({ error: "Forbidden: Super Admin access required" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    if (body.confirm !== "RESET") {
      return Response.json({ error: "Confirmation required: must send confirm='RESET'" }, { status: 400 });
    }

    const summary = {};
    let totalWiped = 0;

    // All application data entities (excluding User — handled separately to preserve super admins)
    const dataEntities = [
      "AdverseMediaScan", "AINarrativeLog", "Alert", "AttendanceRecord", "AuditLogEntry",
      "AutonomousScan", "BackgroundCheck", "BackupRecord", "CalendarEvent",
      "CompanyProfile", "DailyReport", "Employee", "EntityProfile", "ExtractionReview", "FraudAlert",
      "HRAlert", "IngestionAuditFailure", "IngestionBatch", "Investigation", "InvestigationTemplate",
      "OnboardingRequest", "Organization", "OrganizationMember", "PayrollRecord",
      "PlatformSetting", "RegulatoryReport", "RegulatoryUpdate", "RemediationAction",
      "RiskRule", "SourceRecord", "SupportTicket", "SustainabilityAssessment",
      "Transaction", "UserSession", "VendorVerification",
      "RavenIngestion", "RavenIssue", "OversightDepartment", "OversightPurchaseLine",
      "OversightNotification", "OversightAuditEvent"
    ];

    for (const entityName of dataEntities) {
      try {
        let result;
        do {
          result = await base44.asServiceRole.entities[entityName].deleteMany({});
        } while (result?.has_more);
        summary[entityName] = "wiped";
        totalWiped++;
      } catch (e) {
        summary[entityName] = `error: ${e.message}`;
      }
    }

    // Delete non–Super Admin users; retain the caller and other Super Admins.
    let deletedUsers = 0;
    try {
      const allUsers = [];
      for (let offset = 0; ; offset += 200) {
        const page = await base44.asServiceRole.entities.User.list("-created_date", 200, offset);
        allUsers.push(...page);
        if (page.length < 200) break;
      }
      const userErrors = [];
      for (const u of allUsers) {
        if (u.id === caller.id || u.raviqen_role === "super_admin") continue;
        try {
          await base44.asServiceRole.entities.User.delete(u.id);
          deletedUsers++;
        } catch (e) { userErrors.push(`${u.id}: ${e.message}`); }
      }
      summary["Users"] = userErrors.length ? `error: ${userErrors.length} users could not be deleted` : `deleted ${deletedUsers} non–Super Admin users`;
    } catch (e) {
      summary["Users"] = `error: ${e.message}`;
    }

    const failures = Object.entries(summary).filter(([, result]) => String(result).startsWith("error:"));
    return Response.json({
      success: failures.length === 0,
      message: failures.length ? "Factory reset incomplete" : "Factory reset complete",
      entitiesWiped: totalWiped,
      usersDeleted: deletedUsers,
      summary
    }, { status: failures.length ? 500 : 200 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}