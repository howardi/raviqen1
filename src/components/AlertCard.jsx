import React from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import RiskBadge from "./RiskBadge";
import RemediationMenu from "./RemediationMenu";
import FlagEvidenceTag from "./FlagEvidenceTag";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/lib/CurrencyContext";
import { convertAndFormat } from "@/lib/currencyUtils";

const statusStyles = {
  open: "bg-slate-100 text-slate-600",
  investigating: "bg-blue-50 text-blue-700",
  resolved: "bg-emerald-50 text-emerald-700",
  dismissed: "bg-slate-100 text-slate-400",
};

export default function AlertCard({ alert, onClick }) {
  const navigate = useNavigate();
  const { displayCurrency, rates } = useCurrency();
  const handleClick = () => {
    if (onClick) onClick(alert);
    else navigate(`/investigations/${alert.id}`);
  };

  return (
    <div
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") handleClick(); }}
      className="w-full text-left bg-white rounded-xl border border-slate-200 p-4 hover:border-slate-300 hover:shadow-sm transition-all group cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex flex-col gap-1.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <RiskBadge level={alert.risk_level} size="sm" />
              <span className="text-xs font-mono text-slate-400">{alert.transaction_id}</span>
              <span
                className={cn(
                  "text-[10px] font-medium px-1.5 py-0.5 rounded uppercase tracking-wide",
                  statusStyles[alert.status] || statusStyles.open
                )}
              >
                {alert.status}
              </span>
            </div>
            <h4 className="text-sm font-semibold text-[#231F20] truncate">{alert.title}</h4>
            <p className="text-xs text-slate-500 line-clamp-1">{alert.vendor} · {alert.category}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className="text-sm font-bold text-[#231F20] tabular-nums">
            {convertAndFormat(alert.amount, alert.currency || "USD", displayCurrency, rates)}
          </span>
          <div className="flex items-center gap-2">
            <div onClick={(e) => e.stopPropagation()}>
              <RemediationMenu alert={alert} />
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 transition-colors" />
          </div>
        </div>
      </div>
      {alert.flag_reasons && alert.flag_reasons.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-1.5">
          {alert.flag_reasons.slice(0, 5).map((r, i) => (
            <FlagEvidenceTag key={i} flag={r} evidence={alert.flag_evidence} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}