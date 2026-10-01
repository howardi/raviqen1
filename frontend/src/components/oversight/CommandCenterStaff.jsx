import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { DEFAULT_OVERSIGHT_DEPARTMENTS } from "@/lib/oversight";

export default function CommandCenterStaff({ users, tenantId, actorId, onChanged }) {
  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState(DEFAULT_OVERSIGHT_DEPARTMENTS[0].slug);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const audit = async (action, target, detail) => {
    try {
      await base44.entities.OversightAuditEvent.create({
        tenant_id: tenantId,
        action,
        actor_id: actorId,
        target,
        detail,
        created_date: new Date().toISOString(),
      });
    } catch {
      /* audit write is best-effort when the entity schema differs */
    }
  };

  const createUser = async (event) => {
    event.preventDefault();
    setBusy("create");
    setError("");
    try {
      await base44.users.inviteUser(email.trim(), "user");
      const found = await base44.entities.User.filter({ email: email.trim() });
      if (found[0]?.id) {
        await base44.entities.User.update(found[0].id, {
          raviqen_role: "department_user",
          department,
          tenant_id: tenantId,
          account_status: "active",
        });
      }
      await audit("user_created", email.trim(), `Department ${department}`);
      setEmail("");
      await onChanged();
    } catch (err) {
      setError(err.message || "Could not create that user");
    } finally {
      setBusy("");
    }
  };

  const setAccountStatus = async (person, account_status) => {
    setBusy(person.id);
    setError("");
    try {
      await base44.entities.User.update(person.id, { account_status });
      await audit(account_status === "disabled" ? "user_deactivated" : "user_activated", person.email || person.id, account_status);
      await onChanged();
    } catch (err) {
      setError(err.message || "Could not update that user");
    } finally {
      setBusy("");
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-base font-bold text-slate-900">Staff user management</h2>
      <p className="mb-4 text-xs text-slate-500">Create a department account, or activate and deactivate an existing one. Department users cannot open this portal.</p>
      <form onSubmit={createUser} className="grid gap-2 sm:grid-cols-[1fr_180px_auto]">
        <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="staff@company.com" className="rounded-lg border p-2 text-sm" />
        <select value={department} onChange={(e) => setDepartment(e.target.value)} className="rounded-lg border p-2 text-sm">
          {DEFAULT_OVERSIGHT_DEPARTMENTS.map((d) => <option key={d.slug} value={d.slug}>{d.nav_label}</option>)}
        </select>
        <button disabled={busy === "create"} className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50">Create user</button>
      </form>
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
      <div className="mt-4 space-y-2">
        {users.filter((person) => person.raviqen_role !== "super_admin").slice(0, 12).map((person) => (
          <div key={person.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm">
            <div>
              <p className="font-medium text-slate-800">{person.full_name || person.email}</p>
              <p className="text-xs text-slate-500">{person.department || "Unassigned"} · {person.account_status || "active"}</p>
            </div>
            <div className="flex gap-2">
              <button type="button" disabled={busy === person.id} onClick={() => setAccountStatus(person, "active")} className="rounded border px-2 py-1 text-xs">Activate</button>
              <button type="button" disabled={busy === person.id} onClick={() => setAccountStatus(person, "disabled")} className="rounded border px-2 py-1 text-xs">Deactivate</button>
            </div>
          </div>
        ))}
        {!users.length && <p className="text-sm text-slate-500">No department users in this workspace yet.</p>}
      </div>
    </section>
  );
}
