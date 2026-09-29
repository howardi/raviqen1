import React from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import RiskBadge from "@/components/RiskBadge";
import { Building2, ArrowRight, AlertTriangle, FileText } from "lucide-react";
import { formatCurrency } from "@/lib/currencyUtils";

const TAG_CONFIG = {
  low_risk: { label: "Low Risk", classes: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  medium_risk: { label: "Medium Risk", classes: "bg-amber-50 text-amber-700 border-amber-200" },
  high_watch: { label: "High Watch", classes: "bg-orange-50 text-orange-700 border-orange-200" },
  blacklisted: { label: "Blacklisted", classes: "bg-red-50 text-red-700 border-red-200" },
};

const STATUS_CONFIG = {
  active: "bg-emerald-500",
  under_review: "bg-amber-500",
  suspended: "bg-orange-500",
  blacklisted: "bg-red-500",
};


export default function EntityProfileCard({ profile }) {
  const tag = TAG_CONFIG[profile.baseline_risk_tag] || TAG_CONFIG.low_risk;
  const hasCase = !!profile.case_file_ref;
  const anomalyCount = (profile.active_anomaly_flags || []).length;

  return (
    <Link
      to={`/entity-intelligence/${profile.id}`}
      className="block bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md hover:border-slate-300 transition-all group"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
            <Building2 className="w-4.5 h-4.5 text-slate-500" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#231F20] truncate">{profile.legal_name}</p>
            <p className="text-xs text-slate-400 truncate">{profile.profile_id || "—"}</p>
          </div>
        </div>
        <div className={cn("w-2.5 h-2.5 rounded-full shrink-0 mt-1.5", STATUS_CONFIG[profile.status] || "bg-slate-300")} />
      </div>

      <div className="flex items-center gap-2 mb-3">
        <RiskBadge level={profile.risk_level} size="sm" />
        <span className={cn("px-2 py-0.5 rounded-full border text-[10px] font-medium", tag.classes)}>{tag.label}</span>
      </div>

      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100">
        <div>
          <p className="text-base font-bold text-[#231F20] tabular-nums leading-none">{profile.total_invoices || 0}</p>
          <p className="text-[10px] text-slate-400 mt-1">Invoices</p>
        </div>
        <div>
          <p className="text-xs font-bold text-[#231F20] tabular-nums leading-none">{formatCurrency(profile.lifetime_exposure, profile.exposure_currency)}</p>
          <p className="text-[10px] text-slate-400 mt-1">Exposure</p>
        </div>
        <div className="flex items-center gap-1.5">
          {anomalyCount > 0 && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
          {hasCase && <FileText className="w-3.5 h-3.5 text-red-500" />}
          <span className="text-[10px] text-slate-400">{anomalyCount > 0 ? `${anomalyCount} flags` : hasCase ? "Case open" : "Clean"}</span>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-1 text-xs text-slate-400 group-hover:text-slate-700 transition-colors">
        <span>View profile</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </div>
    </Link>
  );
}