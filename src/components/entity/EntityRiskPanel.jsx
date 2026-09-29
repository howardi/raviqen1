import React from "react";
import { cn } from "@/lib/utils";
import { RiskScoreRing } from "@/components/RiskBadge";
import { AlertTriangle, ShieldCheck, Activity, ListChecks, FileText, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

function ScreeningBadge({ label, status }) {
  const colors = {
    clear: "bg-emerald-50 text-emerald-700 border-emerald-200",
    match: "bg-red-50 text-red-700 border-red-200",
    partial_match: "bg-amber-50 text-amber-700 border-amber-200",
    not_checked: "bg-slate-50 text-slate-500 border-slate-200",
    pending: "bg-slate-50 text-slate-500 border-slate-200",
    flagged: "bg-orange-50 text-orange-700 border-orange-200",
    sanctioned: "bg-red-50 text-red-700 border-red-200",
  };
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-50/40 border border-slate-100">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={cn("px-2 py-0.5 rounded-full border text-[10px] font-medium capitalize", colors[status] || colors.not_checked)}>{(status || "not_checked").replace(/_/g, " ")}</span>
    </div>
  );
}

export default function EntityRiskPanel({ profile }) {
  const anomalies = profile.active_anomaly_flags || [];
  const recommendations = profile.workflow_recommendations || [];
  const trend = profile.risk_trend || [];

  return (
    <div className="space-y-4">
      {/* Risk Score + Screening */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col items-center justify-center">
          <RiskScoreRing score={profile.risk_score || 0} level={profile.risk_level || "low"} size={96} />
          <p className="text-xs text-slate-400 mt-3 uppercase tracking-wide">Composite Risk Score</p>
          <p className="text-sm font-semibold text-slate-700 mt-0.5 capitalize">{profile.risk_level || "low"} risk</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="w-4 h-4 text-slate-500" />
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Screening Status</h4>
          </div>
          <ScreeningBadge label="Overall Screening" status={profile.screening_status} />
          <ScreeningBadge label="Sanctions Check" status={profile.sanctions_check} />
          <ScreeningBadge label="PEP Check" status={profile.pep_check} />
          {profile.last_screened && <p className="text-[10px] text-slate-400 pt-1">Last screened: {new Date(profile.last_screened).toLocaleString()}</p>}
        </div>
      </div>

      {/* Risk Trend */}
      {trend.length > 1 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-slate-500" />
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Historical Risk Trend</h4>
          </div>
          <div className="flex items-end gap-1 h-24">
            {trend.slice(-20).map((t, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className={cn("w-full rounded-t transition-all", t.score >= 75 ? "bg-red-400" : t.score >= 55 ? "bg-orange-400" : t.score >= 30 ? "bg-amber-400" : "bg-emerald-400")}
                  style={{ height: `${Math.max(t.score, 4)}%` }}
                  title={`${t.date}: ${t.score}`}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-1.5 text-[10px] text-slate-400">
            <span>{trend[0]?.date}</span>
            <span>{trend[trend.length - 1]?.date}</span>
          </div>
        </div>
      )}

      {/* Anomaly Flags */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Active Anomaly Flags</h4>
        </div>
        {anomalies.length > 0 ? (
          <div className="space-y-1.5">
            {anomalies.map((flag, i) => (
              <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50/50 border border-amber-100">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-700">{flag}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-emerald-600 flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" /> No anomalies detected — behavior within baseline</p>
        )}
      </div>

      {/* Workflow Recommendations */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-3">
          <ListChecks className="w-4 h-4 text-slate-500" />
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Automated Workflow Recommendations</h4>
        </div>
        <div className="space-y-1.5">
          {recommendations.map((rec, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5", i === 0 ? "bg-slate-800 text-white" : "bg-slate-200 text-slate-500")}>{i + 1}</span>
              <p className="text-xs text-slate-700">{rec}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Case File */}
      {profile.case_file_ref && (
        <Link to={`/investigations/${profile.case_file_ref}`} className="block bg-red-50 border border-red-200 rounded-xl p-4 hover:bg-red-50/80 transition-colors">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-red-600" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-700">Case File Open</p>
              <p className="text-xs text-red-500">Auto-generated investigation — click to view</p>
            </div>
            <ExternalLink className="w-4 h-4 text-red-400" />
          </div>
        </Link>
      )}
    </div>
  );
}