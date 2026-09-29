import React, { useState } from "react";
import { Settings, ChevronDown, ChevronUp } from "lucide-react";
import { DEFAULT_PAYROLL_CONFIG } from "@/lib/payrollEngine";

export default function PayrollConfigPanel({ config, onChange }) {
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState(config || DEFAULT_PAYROLL_CONFIG);

  const update = (field, value) => {
    const updated = { ...local, [field]: value };
    setLocal(updated);
    onChange(updated);
  };

  const updateTier = (idx, field, value) => {
    const tiers = [...local.late_deduction_tiers];
    tiers[idx] = { ...tiers[idx], [field]: parseFloat(value) };
    update("late_deduction_tiers", tiers);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50"
      >
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-700">Payroll Configuration</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {open && (
        <div className="p-4 border-t border-slate-100 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Std Hours/Day</label>
              <input type="number" value={local.standard_hours_per_day} onChange={(e) => update("standard_hours_per_day", parseFloat(e.target.value))} className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Std Days/Month</label>
              <input type="number" value={local.standard_days_per_month} onChange={(e) => update("standard_days_per_month", parseFloat(e.target.value))} className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">OT Weekday (x)</label>
              <input type="number" step="0.1" value={local.ot_weekday_multiplier} onChange={(e) => update("ot_weekday_multiplier", parseFloat(e.target.value))} className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">OT Weekend (x)</label>
              <input type="number" step="0.1" value={local.ot_weekend_multiplier} onChange={(e) => update("ot_weekend_multiplier", parseFloat(e.target.value))} className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Std Start Time</label>
              <input type="time" value={local.standard_start_time} onChange={(e) => update("standard_start_time", e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Std End Time</label>
              <input type="time" value={local.standard_end_time} onChange={(e) => update("standard_end_time", e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5" />
            </div>
          </div>

          {/* Late deduction tiers */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">Late Deduction Tiers</label>
            <div className="space-y-2">
              {local.late_deduction_tiers.map((tier, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500 w-16">Tier {i + 1}:</span>
                  <input type="number" value={tier.min_minutes} onChange={(e) => updateTier(i, "min_minutes", e.target.value)} className="w-16 border border-slate-200 rounded px-2 py-1" placeholder="Min" />
                  <span className="text-slate-400">to</span>
                  <input type="number" value={tier.max_minutes} onChange={(e) => updateTier(i, "max_minutes", e.target.value)} className="w-16 border border-slate-200 rounded px-2 py-1" placeholder="Max" />
                  <span className="text-slate-400">min → deduct</span>
                  <input type="number" step="0.25" value={tier.deduction_hours} onChange={(e) => updateTier(i, "deduction_hours", e.target.value)} className="w-16 border border-slate-200 rounded px-2 py-1" placeholder="Hrs" />
                  <span className="text-slate-400">hours</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}