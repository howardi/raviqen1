import React, { useState } from "react";
import { ShieldAlert, X } from "lucide-react";
import { Link } from "react-router-dom";
import RiskBadge from "@/components/RiskBadge";
import { resolveRiskLevel } from "@/lib/riskSeverity";

export default function HighRiskAlertBanner({ alerts }) {
  const [dismissed, setDismissed] = useState(false);

  const highRisk = (alerts || [])
    .map((alert) => ({ ...alert, displayRiskLevel: resolveRiskLevel(alert) }))
    .filter((alert) => alert.status === "open" && (alert.displayRiskLevel === "high" || alert.displayRiskLevel === "critical"))
    .slice(0, 3);

  if (dismissed || highRisk.length === 0) return null;

  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5 text-red-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-red-900">
              {highRisk.length} High-Risk Alert{highRisk.length > 1 ? "s" : ""} Require Immediate Attention
            </h3>
            <div className="mt-2 space-y-1.5">
              {highRisk.map((alert) => (
                <Link
                  key={alert.id}
                  to="/alerts"
                  className="flex items-center gap-2 text-xs text-red-700 hover:text-red-900 transition-colors"
                >
                  <RiskBadge level={alert.displayRiskLevel} score={alert.risk_score} size="sm" />
                  <span className="font-medium truncate">{alert.title}</span>
                  <span className="text-red-400 shrink-0">·</span>
                  <span className="truncate">{alert.vendor}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 rounded-lg hover:bg-red-100 transition-colors shrink-0"
        >
          <X className="w-4 h-4 text-red-600" />
        </button>
      </div>
    </div>
  );
}