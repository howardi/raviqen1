import React from "react";
import { useAuth } from "@/lib/AuthContext";
import { normalizeUserRole } from "@/lib/permissions";
import { DEFAULT_OVERSIGHT_DEPARTMENTS, formSchemaFor, hasAssignedDepartment, needsDepartmentAssignment } from "@/lib/oversight";
import OversightSubmissionForm from "@/components/oversight/OversightSubmissionForm";
import { Navigate } from "react-router-dom";

export default function OversightSubmit() {
  const { user } = useAuth();
  const role = normalizeUserRole(user);
  const department = DEFAULT_OVERSIGHT_DEPARTMENTS.find((d) => d.slug === user?.department) || { slug: user?.department, name: user?.department };
  if (needsDepartmentAssignment(user, role)) return <Navigate to="/oversight/awaiting-assignment" replace />;
  if (!hasAssignedDepartment(user) && !["super_admin", "org_admin", "company_admin", "executive"].includes(role)) {
    return <Navigate to="/oversight/awaiting-assignment" replace />;
  }
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Raviqen · Department submission</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">{department?.name || department?.nav_label || "Department reporting"}</h1>
        <p className="mt-2 text-sm text-slate-600">Submit your daily report. After submit it is locked; send a new report if you need to correct it.</p>
      </header>
      <OversightSubmissionForm department={department.slug} schema={formSchemaFor(department.slug)} />
    </div>
  );
}
