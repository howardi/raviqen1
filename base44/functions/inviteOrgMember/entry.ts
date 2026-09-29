import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { isSuperAdmin } from "../../shared/tenantAuth.ts";
import { enforceUserLimit } from "../../shared/plans.ts";

// Role label mapping for dynamic email copy
const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  org_admin: "Organisation Admin",
  company_admin: "Company Admin",
  executive: "Executive",
  manager: "Manager",
  hr_personnel: "HR Personnel",
  restaurant_manager: "Restaurant Manager",
  operations: "Operations",
  front_desk: "Front Desk",
  investigator: "Investigator / Auditor",
  standard_user: "Standard User",
  read_only: "Read Only",
  member: "Member",
  pending: "Pending",
};

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { organization_id, organization_name, member_email, member_name, role } = body;

    if (!organization_id || !member_email) {
      return Response.json({ error: 'Missing organization_id or member_email' }, { status: 400 });
    }

    // Tenant-scoped RBAC: Super Admin may invite to any organization.
    // Org/Company admins may invite only to an organization where they hold an
    // active admin membership (the organization_id IS the tenant boundary).
    if (!isSuperAdmin(user)) {
      const callerMemberships = await base44.entities.OrganizationMember.filter({
        organization_id,
        user_id: user.id,
        status: "active",
      });
      const isAdminMember = (callerMemberships || []).some(
        (m) => m.role === "company_admin" || m.role === "org_admin"
      );
      if (!isAdminMember) {
        return Response.json({ error: 'Only admins of this organization can invite members' }, { status: 403 });
      }
    }

    // Check for duplicate member
    const existing = await base44.entities.OrganizationMember.filter({
      organization_id,
      user_email: member_email,
    });
    if (existing && existing.length > 0) {
      return Response.json({ error: 'This email is already a member of the organization' }, { status: 409 });
    }

    // Enforce the organization's subscription plan user-seat limit
    const org = await base44.entities.Organization.get(organization_id);
    const plan = org?.subscription_plan || "starter";
    const userCheck = await enforceUserLimit(base44, organization_id, plan);
    if (!userCheck.allowed) {
      return Response.json({
        error: `User limit reached for the ${plan} plan (${userCheck.current}/${userCheck.max}). Upgrade your plan to invite more users.`,
        limit: 'users',
        plan,
        current: userCheck.current,
        max: userCheck.max,
      }, { status: 403 });
    }

    // Create the membership record with the assigned role
    const member = await base44.entities.OrganizationMember.create({
      organization_id,
      organization_name: organization_name || "",
      user_email: member_email,
      user_name: member_name || member_email,
      role: role || "member",
      status: "invited",
      invited_by: user.id,
    });

    // Send a role-specific invitation email with dynamic role copy
    const roleLabel = ROLE_LABELS[role] || ROLE_LABELS["member"] || "Member";
    const loginUrl = `https://raviqen.com/login`;
    const subject = `You've been invited as ${roleLabel} to join RAVIQEN`;
    const emailBody = `Hello ${member_name || member_email},

You have been invited as ${roleLabel} to join RAVIQEN — AI Risk & Compliance Intelligence.

Organization: ${organization_name || "Your Organization"}
Your assigned role: ${roleLabel}

To accept this invitation and set up your account, click the link below:
${loginUrl}

Your role (${roleLabel}) will be automatically applied when you complete your registration with this email address.

If you did not expect this invitation, please contact your administrator immediately.

— RAVIQEN Security Team`;

    try {
      await base44.integrations.Core.SendEmail({
        to: member_email,
        subject,
        body: emailBody,
      });
    } catch (emailErr) {
      // Email send failure is non-critical — the membership record is still created
    }

    return Response.json({
      success: true,
      member,
      role_label: roleLabel,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}