import React from "react";
import {
  ShieldAlert, ShieldX, Shield, CheckCircle2, AlertTriangle,
  Sparkles, FileText, Calendar, User, Fingerprint, Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import RiskBadge from "@/components/RiskBadge";
import ConvertToEmployeeButton from "@/components/hr/ConvertToEmployeeButton";
import { exportBackgroundCheckPDF } from "@/lib/hrExports";
import { useCompanyProfile } from "@/lib/CompanyProfileContext";

const CHECK_STATUS_CONFIG = {
  verified: { icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50", label: "Verified" },
  clear: { icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50", label: "Clear" },
  mismatch: { icon: AlertTriangle, color: "text-amber-600 bg-amber-50", label: "Mismatch" },
  discrepancy: { icon: AlertTriangle, color: "text-amber-600 bg-amber-50", label: "Discrepancy" },
  partial_match: { icon: AlertTriangle, color: "text-orange-600 bg-orange-50", label: "Partial Match" },
  flagged: { icon: ShieldAlert, color: "text-orange-600 bg-orange-50", label: "Flagged" },
  failed: { icon: ShieldX, color: "text-red-600 bg-red-50", label: "Failed" },
  match: { icon: ShieldX, color: "text-red-600 bg-red-50", label: "Match" },
  pending: { icon: Shield, color: "text-slate-400 bg-slate-50", label: "Pending" },
};

const OVERALL_CONFIG = {
  cleared: { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200", label: "Cleared — Recommended to Proceed" },
  flagged: { icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50 border-amber-200", label: "Flagged — Additional Verification Required" },
  rejected: { icon: ShieldX, color: "text-red-600", bg: "bg-red-50 border-red-200", label: "Rejected — Do Not Proceed" },
  pending: { icon: Shield, color: "text-slate-400", bg: "bg-slate-50 border-slate-200", label: "Pending" },
  in_progress: { icon: Shield, color: "text-blue-600", bg: "bg-blue-50 border-blue-200", label: "Screening in Progress" },
};

export default function BackgroundCheckResult({ check, onConverted }) {
  const overall = OVERALL_CONFIG[check.overall_status] || OVERALL_CONFIG.pending;
  const OIcon = overall.icon;
  const { profile } = useCompanyProfile();

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className={cn("p-4 border-b", overall.bg, "border-current/20")}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center bg-white", overall.color)}>
              <OIcon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#231F20]">{check.candidate_name}</p>
              <p className="text-xs text-slate-500">{check.position_applied || "Position not specified"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportBackgroundCheckPDF(check, profile)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/80 text-slate-600 text-xs font-medium hover:bg-white border border-slate-200"
            >
              <Download className="w-3 h-3" /> PDF
            </button>
            <RiskBadge level={check.risk_level} />
          </div>
        </div>
        <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
          <span className="flex items-center gap-1"><Fingerprint className="w-3 h-3" />ID: {check.national_id}</span>
          {check.screening_date && (
            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(check.screening_date).toLocaleDateString()}</span>
          )}
          <span className="flex items-center gap-1"><User className="w-3 h-3" />{check.screened_by}</span>
        </div>
      </div>

      {/* Overall verdict */}
      <div className={cn("px-4 py-3 border-b border-slate-100 flex items-center gap-2", overall.bg)}>
        <OIcon className={cn("w-4 h-4", overall.color)} />
        <span className={cn("text-sm font-medium", overall.color)}>{overall.label}</span>
        <span className="ml-auto text-sm font-bold tabular-nums text-slate-600">Risk Score: {check.risk_score}/100</span>
      </div>

      {/* Individual checks */}
      <div className="p-4 space-y-2">
        <p className="text-xs font-medium text-slate-500 mb-2">Screening Results</p>
        {check.screening_results?.map((r, i) => {
          const sc = CHECK_STATUS_CONFIG[r.status] || CHECK_STATUS_CONFIG.pending;
          const SIcon = sc.icon;
          return (
            <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50/60 border border-slate-100">
              <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0", sc.color)}>
                <SIcon className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-700">{r.check_name}</p>
                <p className="text-[11px] text-slate-400 truncate">{r.details}</p>
              </div>
              <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full", sc.color)}>{sc.label}</span>
            </div>
          );
        })}
      </div>

      {/* Flags */}
      {check.flags?.length > 0 && (
        <div className="px-4 pb-3">
          <div className="flex flex-wrap gap-1.5">
            {check.flags.map((f, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-50 text-red-700 border border-red-200">
                <AlertTriangle className="w-2.5 h-2.5" /> {f}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* AI Assessment */}
      {check.ai_assessment && (
        <div className="px-4 pb-4">
          <div className="p-3 rounded-lg bg-slate-900 text-white">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span className="text-xs font-semibold">AI Risk Assessment</span>
            </div>
            <p className="text-xs text-slate-200 leading-relaxed">{check.ai_assessment}</p>
          </div>
        </div>
      )}

      {/* Recommendations */}
      {check.recommendations?.length > 0 && (
        <div className="px-4 pb-4">
          <p className="text-xs font-medium text-slate-500 mb-2">Hiring Recommendations</p>
          <div className="space-y-1.5">
            {check.recommendations.map((r, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-slate-600">
                <FileText className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                <span>{r}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Convert to Employee */}
      <ConvertToEmployeeButton check={check} onConverted={onConverted} />
    </div>
  );
}