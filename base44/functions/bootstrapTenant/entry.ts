import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { isSuperAdmin, getTenantId } from "../../shared/tenantAuth.ts";

// Operational entities to backfill with tenant_id (= organization_id).
const OPERATIONAL_ENTITIES = [
  "Transaction",
  "Alert",
  "Investigation",
  "EntityProfile",
  "AutonomousScan",
  "VendorVerification",
  "DailyReport",
  "RegulatoryReport",
  "IngestionBatch",
  "AdverseMediaScan",
  "CalendarEvent",
  "SustainabilityAssessment",
  "Employee",
  "PayrollRecord",
  "AttendanceRecord",
  "HRAlert",
  "BackgroundCheck",
  "RiskRule",
  "RegulatoryUpdate",
  "SourceRecord",
  "AuditLogEntry",
  "RemediationAction",
  "SupportTicket",
  "BackupRecord",
  "UserSession",
];

// Migration / provisioning endpoint:
//  1. Resolves a user's tenant from the organization they own or belong to.
//  2. Stamps user.tenant_id (self via updateMe, others via service role for Super Admin).
//  3. Backfills tenant_id onto the user's existing records across operational entities.
// Call with no body to self-provision, or { user_id, tenant_id? } as Super Admin to
// provision another user.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const targetUserId = body.user_id || user.id;

    // Only Super Admin may provision another user.
    if (targetUserId !== user.id && !isSuperAdmin(user)) {
      return Response.json({ error: 'Only Super Admin can provision another user tenant' }, { status: 403 });
    }

    // Resolve the target tenant server-side. A caller-supplied tenant_id is only
    // honored when a Super Admin provisions another user, and only if it refers
    // to an active organization. Self-provisioning resolves the tenant solely
    // from verified organization ownership or an active admin-created membership.
    let tenantId = null;

    if (targetUserId !== user.id && isSuperAdmin(user) && body.tenant_id) {
      const org = await base44.asServiceRole.entities.Organization.get(body.tenant_id);
      if (!org || org.status !== "active") {
        return Response.json({ error: 'Invalid or inactive organization' }, { status: 400 });
      }
      tenantId = body.tenant_id;
    } else if (targetUserId === user.id) {
      tenantId = getTenantId(user);
    }

    if (!tenantId) {
      const owned = await base44.asServiceRole.entities.Organization.filter({
        owner_id: targetUserId,
        status: "active",
      });
      if (owned && owned.length > 0) {
        tenantId = owned[0].id;
      } else {
        const membership = await base44.asServiceRole.entities.OrganizationMember.filter({
          user_id: targetUserId,
          status: "active",
        });
        const validMembership = (membership || []).find((m) => m.invited_by);
        if (validMembership) {
          tenantId = validMembership.organization_id;
        }
      }
    }

    if (!tenantId) {
      return Response.json({
        error: 'No active organization found for this user. Create or assign an organization first.',
      }, { status: 400 });
    }

    // 1) Stamp the user's tenant_id.
    if (targetUserId === user.id) {
      await base44.auth.updateMe({ tenant_id: tenantId });
    } else {
      try {
        await base44.asServiceRole.entities.User.update(targetUserId, { tenant_id: tenantId });
      } catch (e) {
        // Service-role User update may be restricted; the user can self-provision on next login.
        return Response.json({
          success: false,
          error: 'Could not update user tenant_id directly. Ask the user to log in and self-provision.',
          tenant_id: tenantId,
        }, { status: 200 });
      }
    }

    // 2) Backfill tenant_id onto the target's existing records (only records missing it).
    const backfill = {};
    for (const name of OPERATIONAL_ENTITIES) {
      try {
        const entity = base44.asServiceRole.entities[name];
        if (!entity || typeof entity.updateMany !== 'function') continue;
        const res = await entity.updateMany(
          { created_by_id: targetUserId, tenant_id: { $exists: false } },
          { $set: { tenant_id: tenantId } }
        );
        backfill[name] = { updated: res?.modifiedCount ?? res?.count ?? null };
      } catch (e) {
        backfill[name] = { error: e.message };
      }
    }

    return Response.json({
      success: true,
      user_id: targetUserId,
      tenant_id: tenantId,
      backfill,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}