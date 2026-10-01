import React, { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { normalizeUserRole } from "@/lib/permissions";
import { DEFAULT_OVERSIGHT_DEPARTMENTS, formSchemaFor, hasAssignedDepartment, needsDepartmentAssignment } from "@/lib/oversight";
import { answerStaffQuestion } from "@/lib/riskMandate";
import OversightSubmissionForm from "@/components/oversight/OversightSubmissionForm";
import { Navigate } from "react-router-dom";

export default function OversightSubmit() {
  const { user } = useAuth();
  const role = normalizeUserRole(user);
  const department = DEFAULT_OVERSIGHT_DEPARTMENTS.find((d) => d.slug === user?.department) || { slug: user?.department, name: user?.department };
  const schema = formSchemaFor(department.slug);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
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
      <OversightSubmissionForm department={department.slug} schema={schema} />
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-bold text-slate-900">Report helper</h2>
        <p className="mt-1 text-xs text-slate-500">This helper only knows your assigned form. It cannot see other departments, management analysis, or ingested records.</p>
        <form className="mt-3 flex flex-col gap-2 sm:flex-row" onSubmit={(event) => {
          event.preventDefault();
          setAnswer(answerStaffQuestion(question, department.nav_label || department.name || "department", (schema.fields || []).map((field) => field.label)));
        }}>
          <input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask about today's report" className="flex-1 rounded-lg border p-2 text-sm" />
          <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white">Ask</button>
        </form>
        {answer && <p className="mt-3 text-sm text-slate-700">{answer}</p>}
      </section>
    </div>
  );
}
