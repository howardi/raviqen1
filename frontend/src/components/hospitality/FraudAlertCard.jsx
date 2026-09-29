import React, { useState } from "react";
import { Building2, UtensilsCrossed, Hotel, ShieldAlert, ShieldX, AlertTriangle, ShieldCheck, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const RISK_STYLES = {
  CRITICAL: { badge: "bg-red-100 text-red-700 border-red-200", dot: "bg-red-500", icon: ShieldX },
  HIGH: { badge: "bg-orange-100 text-orange-700 border-orange-200", dot: "bg-orange-500", icon: ShieldAlert },
  MEDIUM: { badge: "bg-amber-100 text-amber-700 border-amber-200", dot: "bg-amber-500", icon: AlertTriangle },
  "LOW-MEDIUM": { badge: "bg-yellow-100 text-yellow-700 border-yellow-200", dot: "bg-yellow-500", icon: AlertTriangle },
  LOW: { badge: "bg-emerald-100 text-emerald-700 border-emerald-200", dot: "bg-emerald-500", icon: ShieldCheck },
};

const DEPT_META = {
  Front_Desk: { label: "Front Desk (PMS)", icon: Hotel, tone: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  Restaurant_POS: { label: "Restaurant & Bar (POS)", icon: UtensilsCrossed, tone: "bg-rose-50 text-rose-700 border-rose-200" },
  Corporate_HR: { label: "Corporate HR & Expense", icon: Building2, tone: "bg-sky-50 text-sky-700 border-sky-200" },
};

export default function FraudAlertCard({ alert }) {
  const [expanded, setExpanded] = useState(false);
  const risk = RISK_STYLES[alert.overall_risk_level] || RISK_STYLES.LOW;
  const dept = DEPT_META[alert.department] || DEPT_META.Corporate_HR;
  const RiskIcon = risk.icon;
  const DeptIcon = dept.icon;
  const fva = alert.fraud_vector_analysis || {};

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 hover:bg-slate-50/60 transition-colors text-left"
      >
        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border", dept.tone)}>
          <DeptIcon className="w-4.5 h-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-[#231F20] truncate">{fva.status || alert.event_id}</p>
            <span className="px-1.5 py-0.5 rounded font-mono text-[10px] font-bold bg-slate-100 text-slate-600">{fva.flagged_rule}</span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5 truncate">
            <span className="font-mono">{alert.event_id}</span>
            {alert.employee_id && alert.employee_id !== "UNKNOWN" ? ` · ${alert.employee_id}` : ""}
          </p>
        </div>
        <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold shrink-0", risk.badge)}>
          <RiskIcon className="w-3.5 h-3.5" />
          {alert.overall_risk_level}
        </span>
        <div className="shrink-0 text-slate-400">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-100 pt-3">
          <Field label="Detected Anomaly" value={fva.detected_anomaly} />
          <Field label="Calculated Metric" value={fva.calculated_metric} mono />
          <Field label="Recommended Action" value={alert.recommended_action} />
          <div className="pt-2">
            <p className="text-[10px] font-semibold text-slate-400 uppercase mb-1">Raw JSON Payload</p>
            <pre className="text-[11px] bg-slate-900 text-slate-100 rounded-lg p-3 overflow-x-auto font-mono leading-relaxed">
{JSON.stringify(alert, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, mono }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-slate-400 uppercase">{label}</p>
      <p className={cn("text-sm text-slate-700 mt-0.5", mono && "font-mono text-xs")}>{value || "—"}</p>
    </div>
  );
}