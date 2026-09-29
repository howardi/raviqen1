import React from "react";
import { ShieldX, ArrowRight, AlertTriangle, Trash2 } from "lucide-react";
import RiskBadge from "@/components/RiskBadge";
import { formatCurrency } from "@/lib/currencyUtils";
import { resolveRiskLevel } from "@/lib/riskSeverity";

export default function CriticalSummary({ transactions, loading, onInvestigate, onDelete }) {
  // The parent (Dashboard) pre-filters transactions to those linked to OPEN
  // alerts — the single authoritative status field. We only filter by risk
  // level here; we do NOT re-filter by Transaction.status, which could
  // disagree with Alert.status and cause contradictory metrics.
  const critical = transactions
    .map((transaction) => ({ ...transaction, displayRiskLevel: resolveRiskLevel(transaction) }))
    .filter((transaction) => transaction.displayRiskLevel === "critical" || transaction.displayRiskLevel === "high")
    .sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0))
    .slice(0, 5);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border-2 border-red-200 p-5">
        <div className="h-6 w-48 bg-slate-100 rounded animate-pulse mb-4" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-slate-100 rounded-lg animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border-2 border-red-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
            <ShieldX className="w-4 h-4 text-red-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#231F20]">Critical Action Required</h3>
            <p className="text-xs text-slate-500">High-risk flagged transactions needing immediate attention</p>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-full bg-red-50 text-red-700 text-xs font-bold border border-red-200">
          {critical.length} urgent
        </span>
      </div>

      {critical.length === 0 ? (
        <div className="text-center py-8">
          <AlertTriangle className="w-8 h-8 mx-auto text-emerald-400 mb-2" />
          <p className="text-sm text-slate-500">No critical transactions right now.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {critical.map((tx) => (
            <div key={tx.id} className="flex items-center gap-2 sm:gap-3 p-3 rounded-lg border border-slate-100 hover:border-red-200 hover:bg-red-50/30 transition-colors">
              <RiskBadge level={tx.displayRiskLevel} score={tx.risk_score} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#231F20] truncate">{tx.vendor}</p>
                <p className="text-xs text-slate-500 font-mono truncate">
                  {tx.transaction_id} · {formatCurrency(tx.amount, tx.currency)}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-bold text-red-600">{tx.risk_score?.toFixed(0)}</p>
                <p className="text-[10px] text-slate-400">risk</p>
              </div>
              <button
                onClick={() => onInvestigate(tx)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 transition-colors shrink-0"
              >
                <span className="hidden sm:inline">Investigate</span> <ArrowRight className="w-3 h-3" />
              </button>
              <button
                onClick={() => onDelete(tx)}
                className="inline-flex items-center justify-center w-7 h-7 rounded-lg border border-slate-200 text-slate-400 hover:border-red-300 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
                title="Delete transaction"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}