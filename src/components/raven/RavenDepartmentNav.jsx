import React from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import { RAVEN_DEPARTMENTS } from '@/components/raven/departments';

export default function RavenDepartmentNav() {
  const { department } = useParams();
  const { pathname } = useLocation();
  return <nav aria-label="Raviqen departments" className="flex gap-2 overflow-x-auto pb-2 md:flex-wrap md:overflow-visible">
    <Link to="/oversight" className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold ${pathname === '/oversight' || pathname === '/raven' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 border border-slate-200'}`}>Raviqen Inbox</Link>
    {RAVEN_DEPARTMENTS.map(d => <Link key={d.id} to={`/oversight/${d.id}`} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold ${department === d.id ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 border border-slate-200'}`}>{d.label}</Link>)}
    <Link to="/oversight/investigation" className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold ${pathname === '/oversight/investigation' || pathname === '/raven/investigation' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 border border-slate-200'}`}>Overall Business Investigation</Link>
  </nav>;
}