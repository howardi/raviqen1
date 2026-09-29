import React from "react";
import { AlertTriangle, Ghost, Clock, ShieldAlert, UserX, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

const ALERT_CONFIG = {
  attendance_anomaly: { icon: Clock, color: "text-amber-600 bg-amber-50", label: "Attendance Anomaly" },
  policy_breach: { icon: ShieldAlert, color: "text-red-600 bg-red-50", label: "Policy Breach" },
  background_check_update: { icon: AlertTriangle, color: "text-violet-600 bg-violet-50", label: "Background Check Update" },
  ghost_worker: { icon: Ghost, color: "text-red-600 bg-red-50", label: "Ghost Worker" },
  unauthorized_overtime: { icon: Clock, color: "text-orange-600 bg-orange-50", label: "Unauthorized Overtime" },
  chronic_absenteeism: { icon: UserX, color: "text-red-600 bg-red-50", label: "Chronic Absenteeism" },
};

const SEVERITY_CONFIG = {
  low: "border-l-slate-400",
  medium: "border-l-amber-400",
  high: "border-l-orange-500",
  critical: "border-l-red-500",
};

export default function HRAlertsPanel({ alerts, loading, onDismiss }) {
  if (loading) {
    return <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-lg bg-slate-100 animate-pulse" />)}</div>;
  }
  if (alerts.length === 0) {
    return (
      <div className="text-center py-8 bg-white rounded-xl border border-slate-200">
        <ShieldAlert className="w-8 h-8 mx-auto text-slate-300 mb-2" />
        <p className="text-sm text-slate-400">No HR risk alerts</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {alerts.map((a) => {
        const config = ALERT_CONFIG[a.alert_type] || ALERT_CONFIG.attendance_anomaly;
        const AIcon = config.icon;
        return (
          <div key={a.id} className={cn("bg-white rounded-xl border border-slate-200 border-l-4 p-3 flex items-start gap-3", SEVERITY_CONFIG[a.severity])}>
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", config.color)}>
              <AIcon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-xs font-semibold text-[#231F20]">{a.employee_name || a.employee_id}</p>
                <span className="text-[10px] text-slate-400">{config.label}</span>
              </div>
              <p className="text-xs text-slate-600">{a.description}</p>
              <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-400">
                <span className="flex items-center gap-0.5"><Calendar className="w-2.5 h-2.5" /> {a.department || "—"}</span>
                <span className={cn("font-medium", a.severity === "critical" ? "text-red-600" : a.severity === "high" ? "text-orange-600" : "text-amber-600")}>{a.severity}</span>
              </div>
            </div>
            {onDismiss && a.status === "open" && (
              <button onClick={() => onDismiss(a)} className="text-[10px] text-slate-400 hover:text-slate-700 shrink-0">Dismiss</button>
            )}
          </div>
        );
      })}
    </div>
  );
}