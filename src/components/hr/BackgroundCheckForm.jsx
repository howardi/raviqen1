import React, { useState } from "react";
import { Loader2, ShieldCheck, Scan } from "lucide-react";

const DEPARTMENTS = [
  { value: "restaurant", label: "Restaurant / F&B" },
  { value: "operations", label: "Operations" },
  { value: "front_desk", label: "Front Desk" },
  { value: "hr", label: "Human Resources" },
  { value: "finance", label: "Finance" },
  { value: "general", label: "General" },
];

export default function BackgroundCheckForm({ user, onScreening }) {
  const [form, setForm] = useState({
    candidate_name: "",
    national_id: "",
    tax_number: "",
    date_of_birth: "",
    position_applied: "",
    department: "restaurant",
    previous_employer: "",
  });
  const [screening, setScreening] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.candidate_name.trim() || !form.national_id.trim()) return;
    setScreening(true);
    await onScreening(form);
    setForm({
      candidate_name: "", national_id: "", tax_number: "", date_of_birth: "",
      position_applied: "", department: "restaurant", previous_employer: "",
    });
    setScreening(false);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center">
          <ShieldCheck className="w-4 h-4 text-white" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[#231F20]">New Background Screening</h3>
          <p className="text-[11px] text-slate-400">Enter candidate details to run automated screening</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1.5 block">Full Name *</label>
          <input
            type="text"
            value={form.candidate_name}
            onChange={(e) => setForm({ ...form, candidate_name: e.target.value })}
            placeholder="John Doe"
            className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-slate-400"
            required
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1.5 block">National ID / SSN *</label>
          <input
            type="text"
            value={form.national_id}
            onChange={(e) => setForm({ ...form, national_id: e.target.value })}
            placeholder="XXX-XX-XXXX"
            className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-slate-400"
            required
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1.5 block">Tax Number / TIN</label>
          <input
            type="text"
            value={form.tax_number}
            onChange={(e) => setForm({ ...form, tax_number: e.target.value })}
            placeholder="TIN-000-000"
            className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-slate-400"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1.5 block">Date of Birth</label>
          <input
            type="date"
            value={form.date_of_birth}
            onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
            className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-slate-400"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1.5 block">Position Applied For</label>
          <input
            type="text"
            value={form.position_applied}
            onChange={(e) => setForm({ ...form, position_applied: e.target.value })}
            placeholder="Restaurant Manager"
            className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-slate-400"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1.5 block">Target Department</label>
          <select
            value={form.department}
            onChange={(e) => setForm({ ...form, department: e.target.value })}
            className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 outline-none bg-white"
          >
            {DEPARTMENTS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-slate-600 mb-1.5 block">Most Recent Employer</label>
        <input
          type="text"
          value={form.previous_employer}
          onChange={(e) => setForm({ ...form, previous_employer: e.target.value })}
          placeholder="Previous company name"
          className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-slate-400"
        />
      </div>

      <button
        type="submit"
        disabled={screening || !form.candidate_name.trim() || !form.national_id.trim()}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors w-full justify-center"
      >
        {screening ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Running Background Screening…</>
        ) : (
          <><Scan className="w-4 h-4" /> Run Background Screening</>
        )}
      </button>
    </form>
  );
}