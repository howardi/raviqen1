import React, { useState } from "react";
import { FileText, CheckCircle2, Circle, MapPin, Calendar, CreditCard, DollarSign, Building2 } from "lucide-react";
import RiskBadge from "@/components/RiskBadge";
import { formatCurrency } from "@/lib/currencyUtils";

function DetailRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-slate-50/60 border border-slate-100">
      <Icon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      <span className="text-xs font-medium text-slate-500 w-28 shrink-0">{label}</span>
      <span className="text-xs text-slate-800 font-medium truncate">{value}</span>
    </div>
  );
}

export default function StepEvidence({ investigation, alert, transaction, evidenceItems, onReviewed }) {
  const [reviewed, setReviewed] = useState(false);

  const handleConfirm = () => {
    setReviewed(true);
    onReviewed();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-[#231F20]">Step 1 — Evidence Review</h2>
          <p className="text-xs text-slate-500">Review the source transaction and anomaly signals before proceeding</p>
        </div>
        <button
          onClick={handleConfirm}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            reviewed ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-900 text-white hover:bg-slate-800"
          }`}
        >
          {reviewed ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
          {reviewed ? "Evidence Reviewed" : "Mark as Reviewed"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Transaction details */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-semibold text-[#231F20]">Transaction Details</h3>
          </div>
          <div className="space-y-2">
            <DetailRow icon={DollarSign} label="Amount" value={formatCurrency(transaction?.amount || alert?.amount || 0, transaction?.currency || alert?.currency)} />
            <DetailRow icon={Building2} label="Vendor" value={transaction?.vendor || investigation?.vendor} />
            <DetailRow icon={Calendar} label="Date" value={transaction?.transaction_date || "—"} />
            <DetailRow icon={CreditCard} label="Payment" value={transaction?.payment_method || "—"} />
            <DetailRow icon={MapPin} label="Location" value={transaction?.location || "—"} />
            <DetailRow icon={FileText} label="Category" value={transaction?.category || alert?.category || "—"} />
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2">
            <RiskBadge level={investigation?.risk_level} size="sm" />
            <span className="text-xs text-slate-400">Risk score: {alert?.risk_score || transaction?.risk_score || "—"}</span>
          </div>
        </div>

        {/* Anomaly signals */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-semibold text-[#231F20]">Anomaly Signals</h3>
          </div>
          <div className="space-y-2">
            {evidenceItems.map((item, i) => (
              <div key={i} className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-slate-50/60 border border-slate-100">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      item.severity === "critical" ? "bg-red-500" : item.severity === "high" ? "bg-orange-500" : "bg-amber-500"
                    }`}
                  />
                  <span className="text-xs font-medium text-slate-600 truncate">{item.label}</span>
                </div>
                <span className="text-xs text-slate-700 font-medium text-right">{item.value}</span>
              </div>
            ))}
            {alert?.flag_reasons?.length > 0 && (
              <div className="pt-2 flex flex-wrap gap-1.5">
                {alert.flag_reasons.map((r, i) => (
                  <span key={i} className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-50 text-slate-600 border border-slate-100">
                    {r}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}