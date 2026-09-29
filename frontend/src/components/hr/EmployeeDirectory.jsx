import React, { useState, useMemo } from "react";
import { Search, Users, Download, Eye, X, Phone, Calendar, Building2, IdCard, AlertTriangle } from "lucide-react";
import RiskBadge from "@/components/RiskBadge";
import { exportEmployeeDirectoryCSV } from "@/lib/hrExports";
import CreatePasswordModal from "@/components/CreatePasswordModal";
import { useAuth } from "@/lib/AuthContext";
import { normalizeUserRole, canManageCredentials } from "@/lib/permissions";
import { KeyRound, Lock } from "lucide-react";

const DEPT_LABELS = {
  restaurant: "Restaurant / F&B", operations: "Operations", front_desk: "Front Desk",
  hr: "Human Resources", finance: "Finance", general: "General",
};

const STATUS_CONFIG = {
  active: { label: "Active", classes: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  on_leave: { label: "On Leave", classes: "bg-amber-50 text-amber-700 border-amber-200" },
  suspended: { label: "Suspended", classes: "bg-orange-50 text-orange-700 border-orange-200" },
  terminated: { label: "Terminated", classes: "bg-red-50 text-red-700 border-red-200" },
};

export default function EmployeeDirectory({ employees, loading, onEdit }) {
  const { user: currentUser } = useAuth();
  const myRole = normalizeUserRole(currentUser);
  const canManageCreds = canManageCredentials(myRole);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState(null);
  const [createPwTarget, setCreatePwTarget] = useState(null);

  const filtered = useMemo(() => {
    return employees.filter((e) => {
      if (search) {
        const q = search.toLowerCase();
        if (!e.full_name?.toLowerCase().includes(q) && !e.employee_id?.toLowerCase().includes(q) && !e.role_title?.toLowerCase().includes(q)) return false;
      }
      if (deptFilter && e.department !== deptFilter) return false;
      if (statusFilter && e.employment_status !== statusFilter) return false;
      return true;
    });
  }, [employees, search, deptFilter, statusFilter]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Toolbar */}
      <div className="p-4 border-b border-slate-100 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="text-sm font-semibold text-[#231F20] flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-500" /> Master Employee Directory
            <span className="text-xs font-normal text-slate-400">({filtered.length} staff)</span>
          </h3>
          <button
            onClick={() => exportEmployeeDirectoryCSV(filtered, { department: deptFilter })}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium hover:bg-slate-200 disabled:opacity-50 transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, ID, role…"
              className="w-full text-sm pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 outline-none focus:border-slate-400"
            />
          </div>
          <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="text-sm px-3 py-1.5 rounded-lg border border-slate-200 outline-none bg-white">
            <option value="">All Departments</option>
            {Object.entries(DEPT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="text-sm px-3 py-1.5 rounded-lg border border-slate-200 outline-none bg-white">
            <option value="">All Statuses</option>
            {Object.entries(STATUS_CONFIG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
          </select>
          {(search || deptFilter || statusFilter) && (
            <button onClick={() => { setSearch(""); setDeptFilter(""); setStatusFilter(""); }} className="text-xs text-slate-500 hover:text-slate-900">Clear</button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        {loading ? (
          <div className="p-4 space-y-2">{[1, 2, 3, 4].map((i) => <div key={i} className="h-10 rounded-lg bg-slate-100 animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <p className="text-sm text-slate-400">No employees found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50/60 text-xs text-slate-500 uppercase tracking-wide">
                <th className="text-left px-4 py-2.5 font-medium">Employee</th>
                <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell">Department</th>
                <th className="text-left px-4 py-2.5 font-medium hidden md:table-cell">Role</th>
                <th className="text-left px-4 py-2.5 font-medium hidden lg:table-cell">Joined</th>
                <th className="text-left px-4 py-2.5 font-medium">Status</th>
                <th className="text-left px-4 py-2.5 font-medium">Risk</th>
                <th className="text-right px-4 py-2.5 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((e) => {
                const sc = STATUS_CONFIG[e.employment_status] || STATUS_CONFIG.active;
                return (
                  <tr key={e.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-white text-xs font-semibold shrink-0">
                          {e.full_name?.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-[#231F20] truncate">{e.full_name}</p>
                          <p className="text-xs text-slate-400">{e.employee_id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-slate-600">{DEPT_LABELS[e.department] || e.department}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-slate-600">{e.role_title || "—"}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-slate-500 text-xs">{e.date_of_joining || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${sc.classes}`}>{sc.label}</span>
                    </td>
                    <td className="px-4 py-3">{(e.risk_flags?.length > 0 || e.risk_score > 0) ? <RiskBadge level={e.risk_score >= 55 ? "high" : e.risk_score >= 30 ? "medium" : "low"} size="sm" /> : <span className="text-xs text-slate-400">—</span>}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setSelected(e)} className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900">
                        <Eye className="w-3.5 h-3.5" /> View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Profile drawer */}
      {selected && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setSelected(null)} />
          <div className="fixed right-0 inset-y-0 z-50 w-full max-w-md bg-white shadow-xl overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-100 p-4 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-[#231F20]">Employee Profile</h4>
              <button onClick={() => setSelected(null)} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4 text-slate-500" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-white text-lg font-semibold">
                  {selected.full_name?.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-[#231F20]">{selected.full_name}</p>
                  <p className="text-xs text-slate-400">{selected.employee_id}</p>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border mt-1 ${STATUS_CONFIG[selected.employment_status]?.classes}`}>{STATUS_CONFIG[selected.employment_status]?.label}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                {[
                  { icon: Building2, label: "Department", value: DEPT_LABELS[selected.department] || selected.department },
                  { icon: Users, label: "Role Title", value: selected.role_title || "—" },
                  { icon: Calendar, label: "Date of Joining", value: selected.date_of_joining || "—" },
                  { icon: IdCard, label: "National ID", value: selected.national_id_ssn || "—" },
                  { icon: IdCard, label: "Tax Number", value: selected.tax_number || "—" },
                  { icon: Phone, label: "Contact Phone", value: selected.contact_phone || "—" },
                  { icon: Phone, label: "Emergency Contact", value: selected.emergency_contact || "—" },
                  { icon: Building2, label: "Bank Account", value: selected.bank_account_details || "—" },
                ].map((f) => {
                  const FIcon = f.icon;
                  return (
                    <div key={f.label} className="p-2.5 rounded-lg bg-slate-50/60 border border-slate-100">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5 flex items-center gap-1"><FIcon className="w-2.5 h-2.5" /> {f.label}</p>
                      <p className="text-slate-700 font-medium truncate">{f.value}</p>
                    </div>
                  );
                })}
              </div>
              {selected.risk_flags?.length > 0 && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                  <p className="text-xs font-medium text-red-700 flex items-center gap-1 mb-1"><AlertTriangle className="w-3 h-3" /> Risk Flags</p>
                  <div className="flex flex-wrap gap-1">
                    {selected.risk_flags.map((f, i) => <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700">{f}</span>)}
                  </div>
                </div>
              )}
              {selected.linked_background_check_id && (
                <div className="p-2.5 rounded-lg bg-violet-50 border border-violet-200 text-xs text-violet-700">
                  ✓ Linked to Background Check: {selected.linked_background_check_id.substring(0, 12)}…
                </div>
              )}

              {/* Manual Password Creation — admin only */}
              {canManageCreds && (
                <div className="pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-2 mb-2">
                    <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                    <p className="text-xs font-semibold text-slate-700">Credential Administration</p>
                  </div>
                  <button
                    onClick={() => setCreatePwTarget({
                      id: selected.id,
                      email: selected.contact_phone ? `${selected.employee_id}@raviqen.local` : selected.employee_id,
                      full_name: selected.full_name,
                      raviqen_role: "standard_user",
                    })}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 transition-colors w-full justify-center"
                  >
                    <KeyRound className="w-3.5 h-3.5" /> Create Password…
                  </button>
                  <p className="text-[10px] text-slate-400 mt-1">Admin-authorized manual credential creation. Action is audit-logged.</p>
                </div>
              )}
              {!canManageCreds && (
                <div className="pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-1.5 p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <Lock className="w-3 h-3 text-slate-400" />
                    <p className="text-[10px] text-slate-400">Credential management requires Super Admin or Organisation Admin role.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {createPwTarget && (
        <CreatePasswordModal
          target={createPwTarget}
          onClose={() => setCreatePwTarget(null)}
          isAdmin={canManageCreds}
          isHighPrivilege={false}
          adminUser={currentUser}
        />
      )}
    </div>
  );
}