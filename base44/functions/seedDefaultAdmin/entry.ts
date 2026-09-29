import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);

    // The default admin email is configured via the SUPPORT_EMAIL secret so the
    // bootstrap address is not predictable from source code.
    const adminEmail = secrets.get("SUPPORT_EMAIL");
    if (!adminEmail) {
      return Response.json({ error: "Default admin email not configured (set the SUPPORT_EMAIL secret)" }, { status: 500 });
    }

    // Idempotency: check if the default admin already exists
    const existingUsers = await base44.asServiceRole.entities.User.filter({ email: adminEmail });

    if (existingUsers && existingUsers.length > 0) {
      const user = existingUsers[0];
      const needsUpdate = user.role !== "super_admin" || user.raviqen_role !== "super_admin";

      if (needsUpdate) {
        await base44.asServiceRole.entities.User.update(user.id, {
          role: "super_admin",
          raviqen_role: "super_admin",
        });
      }

      return Response.json({
        success: true,
        action: needsUpdate ? "updated" : "noop",
        message: `Default admin ${adminEmail} ${needsUpdate ? "role corrected to super_admin" : "already configured"}`,
        user_id: user.id,
        email: user.email,
        role: "super_admin",
      });
    }

    // User doesn't exist — invite them (platform sends account-setup email)
    try {
      await base44.users.inviteUser(adminEmail, "admin");
    } catch (inviteError) {
      return Response.json({
        success: false,
        error: `Failed to invite default admin: ${inviteError.message}`,
      }, { status: 500 });
    }

    // After invite, find the newly created user and elevate to super_admin
    const newUsers = await base44.asServiceRole.entities.User.filter({ email: adminEmail });
    if (newUsers && newUsers.length > 0) {
      const newUser = newUsers[0];
      await base44.asServiceRole.entities.User.update(newUser.id, {
        role: "super_admin",
        raviqen_role: "super_admin",
      });

      return Response.json({
        success: true,
        action: "created",
        message: `Default admin ${adminEmail} provisioned with super_admin role`,
        user_id: newUser.id,
        email: newUser.email,
        role: "super_admin",
        note: "User must check email to complete account setup and set their password",
      });
    }

    return Response.json({
      success: true,
      action: "invited",
      message: `Default admin ${adminEmail} invited — awaiting account setup`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}