import React, { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { DEFAULT_OVERSIGHT_DEPARTMENTS, sortOversightDepartments } from "@/lib/oversight";

export default function OversightDepartmentNav() {
  const { department } = useParams();
  const { pathname } = useLocation();
  const [departments, setDepartments] = useState(DEFAULT_OVERSIGHT_DEPARTMENTS.map((d) => ({ ...d, id: d.slug })));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const seeded = await base44.functions.invoke("seedOversightDepartments", {});
        const rows = sortOversightDepartments(seeded.departments || []).map((row) => (
          row.slug === "procurement" && row.nav_label === "Procurement Dashboard"
            ? { ...row, name: "Storekeeper", nav_label: "Storekeeper Dashboard" }
            : row
        ));
        if (!cancelled && rows.length) setDepartments(rows);
      } catch (_error) {
        /* keep defaults */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const activeInbox = pathname === "/oversight" || pathname === "/raven";
  const activeInvestigation = pathname.endsWith("/investigation");

  return (
    <nav aria-label="Raviqen departments" className="flex gap-2 overflow-x-auto pb-2 md:flex-wrap md:overflow-visible">
      <Link to="/oversight" className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold ${activeInbox ? "bg-slate-900 text-white" : "bg-white text-slate-700 border border-slate-200"}`}>Raviqen Inbox</Link>
      {departments.map((d) => (
        <Link key={d.slug} to={`/oversight/${d.slug}`} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold ${department === d.slug ? "bg-slate-900 text-white" : "bg-white text-slate-700 border border-slate-200"}`}>
          {d.nav_label}
        </Link>
      ))}
      <Link to="/oversight/investigation" className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold ${activeInvestigation ? "bg-slate-900 text-white" : "bg-white text-slate-700 border border-slate-200"}`}>Overall Business Investigation</Link>
    </nav>
  );
}
