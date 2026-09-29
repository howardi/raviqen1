import React, { useState } from "react";
import { ROLES, normalizeUserRole } from "@/lib/permissions";
import { X, Loader2, Shield, ToggleLeft, ToggleRight, Building2 } from "lucide-react";
import { DEFAULT_OVERSIGHT_DEPARTMENTS } from "@/lib/oversight";

const MODULE_FLAGS = [
  { key: "data_ingestion", label: "Data Ingestion", group: "Data & Analytics" },
  { key: "ingestion_screening", label: "Screening Engine", group: "Data & Analytics" },
  { key: "analytics", label: "Analytics / Insights", group: "Data & Analytics" },
  { key: "investigations", label: "Investigations", group: "Investigations" },
  { key: "case_management", label: "Case Management", group: "Investigations" },
  { key: "alerts", label: "Alerts", group: "Overview" },
  { key: "osint_scanner", label: "OSINT Scanner", group: "Autonomous Intelligence" },
  { key: "vendor_verification", label: "Vendor Verification", group: "Autonomous Intelligence" },
  { key: "daily_reports", label: "Daily Reports", group: "Workforce & Operations" },
  { key: "relief_calendar", label: "Calendar", group: "Utilities & Planning" },
  { key: "resource_calculator", label: "Resource Calculator", group: "Utilities & Planning" },
  { key: "reports_exports", label: "Reports & Exports", group: "Compliance & Reporting" },
  { key: "integrations", label: "Integrations", group: "Administration" },
  { key: "settings", label: "Settings", group: "Administration" },
  { key: "audit_log", label: "Audit Log", group: "Administration" },
  { key: "support", label: "Technical Support", group: "Administration" },
  { key: "ai_chatbox", label: "AI Chatbox", group: "Administration" },
  { key: "raviqen_oversight", label: "Raviqen oversight", group: "Administration" },
  { key: "staff_ai_chatbox", label: "Staff AI chatbox (disabled by default)", group: "Administration" },
];

const GROUPED_MODULES = MODULE_FLAGS.reduce((acc, mod) => {
  if (!acc[mod.group]) acc[mod.group] = [];
  acc[mod.group].push(mod);
  return acc;
}, {});

export default function UserEditModal({ user, orgs = [], currentOrgId, onClose, onSave }) {
  const currentRole = normalizeUserRole(user);
  const [selectedRole, setSelectedRole] = useState(currentRole);
  const [selectedOrgId, setSelectedOrgId] = useState(currentOrgId || "");
  const [selectedDepartment, setSelectedDepartment] = useState(user.department || 'general');
  const [flags, setFlags] = useState(user.feature_flags || {});
  const [saving, setSaving] = useState(false);

  const toggleFlag = (key) => {
    setFlags((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const setAllInGroup = (group, value) => {
    const groupModules = GROUPED_MODULES[group] || [];
    const updates = {};
    groupModules.forEach((m) => { updates[m.key] = value; });
    setFlags((prev) => ({ ...prev, ...updates }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(user.id, selectedRole, flags, selectedOrgId, selectedDepartment);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200">
          <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-[#231F20]">Edit Permissions & Role</h2>
            <p className="text-xs text-slate-500 truncate">{user.full_name || user.email}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Role assignment */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2 block">Assigned Role</label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full text-sm px-3 py-2.5 rounded-lg border border-slate-200 outline-none bg-white focus:border-slate-400 focus:ring-1 focus:ring-slate-300"
            >
              {Object.entries(ROLES).map(([key, r]) => (
                <option key={key} value={key}>{r.label} — {r.description}</option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400 mt-1.5">
              {ROLES[selectedRole]?.description}
            </p>
          </div>

          {/* Organization assignment */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" /> Organization
            </label>
            <select
              value={selectedOrgId}
              onChange={(e) => setSelectedOrgId(e.target.value)}
              className="w-full text-sm px-3 py-2.5 rounded-lg border border-slate-200 outline-none bg-white focus:border-slate-400 focus:ring-1 focus:ring-slate-300"
            >
              <option value="">— Unassigned (no organization) —</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400 mt-1.5">
              Assigning an organization sets this user's tenant for data isolation and updates their organization membership.
            </p>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2 block" htmlFor="assigned-department">Assigned department</label>
            <select id="assigned-department" value={selectedDepartment} onChange={e => setSelectedDepartment(e.target.value)} className="w-full text-sm px-3 py-2.5 rounded-lg border border-slate-200 bg-white">
              <option value="general">Not assigned to a department</option>
              {DEFAULT_OVERSIGHT_DEPARTMENTS.map(dept => <option key={dept.slug} value={dept.slug}>{dept.name}</option>)}
            </select>
            <p className="text-[11px] text-slate-400 mt-1.5">Department accounts can only submit reports for this department.</p>
          </div>

          {/* Feature flags */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Module / Feature Access</label>
              <span className="text-[10px] text-slate-400">
                {Object.values(flags).filter(Boolean).length} of {MODULE_FLAGS.length} enabled
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mb-3">
              Toggle individual modules for this user. Unchecked modules inherit organization defaults.
            </p>
            <div className="space-y-3">
              {Object.entries(GROUPED_MODULES).map(([group, modules]) => (
                <div key={group} className="border border-slate-100 rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between bg-slate-50 px-3 py-2">
                    <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">{group}</span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setAllInGroup(group, true)}
                        className="text-[10px] px-2 py-0.5 rounded text-emerald-600 hover:bg-emerald-50 transition-colors"
                      >Enable all</button>
                      <button
                        onClick={() => setAllInGroup(group, false)}
                        className="text-[10px] px-2 py-0.5 rounded text-slate-500 hover:bg-slate-100 transition-colors"
                      >Disable all</button>
                    </div>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {modules.map((mod) => {
                      const enabled = flags[mod.key] === true;
                      return (
                        <div key={mod.key} className="flex items-center justify-between px-3 py-2 hover:bg-slate-50/50">
                          <span className="text-xs text-slate-700">{mod.label}</span>
                          <button
                            onClick={() => toggleFlag(mod.key)}
                            className={`flex items-center gap-1 text-xs font-medium transition-colors ${enabled ? "text-emerald-600" : "text-slate-400"}`}
                          >
                            {enabled ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                            {enabled ? "Enabled" : "Disabled"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 py-4 border-t border-slate-200 bg-slate-50">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-slate-700 text-sm font-medium hover:bg-white disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
            {saving ? "Saving..." : "Save Permissions"}
          </button>
        </div>
      </div>
    </div>
  );
}