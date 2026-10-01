import React, { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { DEFAULT_OVERSIGHT_DEPARTMENTS, sortOversightDepartments } from "@/lib/oversight";

export default function OversightDepartmentNav() {
  const { department } = useParams();
  const { pathname } = useLocation();
  const [departments, setDepartments] = useState(DEFAULT_OVERSIGHT_DEPARTMENTS);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const seeded = await base44.functions.invoke("seedOversightDepartments", {});
        const rows = sortOversightDepartments(seeded.departments || []);
        if (!cancelled && rows.length) setDepartments(rows);
      } catch (_error) {
        /* keep the default command-center order */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const activeInvestigation = pathname.endsWith("/investigation");
  const tabClass = (active) => `shrink-0 rounded-lg px-3 py-2 text-xs font-semibold ${active ? "bg-slate-900 text-white" : "bg-white text-slate-700 border border-slate-200"}`;

  return (
    <nav aria-label="Super Admin Command Center" className="flex gap-2 overflow-x-auto pb-1">
      {departments.map((d) => (
        <Link key={d.slug} to={`/oversight/${d.slug}`} className={tabClass(department === d.slug)}>
          {DEFAULT_OVERSIGHT_DEPARTMENTS.find((item) => item.slug === d.slug)?.nav_label || d.nav_label}
        </Link>
      ))}
      <Link to="/oversight/investigation" className={tabClass(activeInvestigation)}>
        ⭐ Overall Business Investigation
      </Link>
    </nav>
  );
}
