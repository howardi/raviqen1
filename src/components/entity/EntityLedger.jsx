import React, { useState, useEffect } from "react";
import { aggregateTransactions, computeBaselineMetrics } from "@/lib/entityIntelligence";
import RiskBadge from "@/components/RiskBadge";
import { Loader2, Receipt, TrendingUp, Calendar, Layers } from "lucide-react";
import { formatCurrency, fetchFxRates } from "@/lib/currencyUtils";


export default function EntityLedger({ profile }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [baseline, setBaseline] = useState(null);

  useEffect(() => {
    (async () => {
      if (!profile?.id) return;
      setLoading(true);
      try {
        const txns = await aggregateTransactions(profile);
        const rates = await fetchFxRates();
        setTransactions(txns);
        setBaseline(computeBaselineMetrics(txns, rates));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [profile?.id]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-slate-300 animate-spin" /></div>;

  const metrics = [
    { icon: Receipt, label: "Total Invoices", value: baseline?.total_invoices || 0 },
    { icon: TrendingUp, label: "Lifetime Exposure", value: formatCurrency(baseline?.lifetime_exposure, profile?.exposure_currency) },
    { icon: Calendar, label: "Avg Days Between Payments", value: baseline?.payment_frequency_days || 0 },
    { icon: Layers, label: "Avg Invoice Amount", value: formatCurrency(baseline?.avg_invoice_amount, profile?.exposure_currency) },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <div key={m.label} className="bg-white rounded-xl border border-slate-200 p-4">
              <Icon className="w-4 h-4 text-slate-400 mb-2" />
              <p className="text-lg font-bold text-[#231F20] tabular-nums leading-none">{m.value}</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wide mt-1.5">{m.label}</p>
            </div>
          );
        })}
      </div>

      {baseline && baseline.currency_distribution?.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Currency Distribution</h4>
          <div className="flex flex-wrap gap-2">
            {baseline.currency_distribution.map((c) => (
              <span key={c.currency} className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-100 text-xs font-medium text-slate-700">
                {c.currency}: <span className="tabular-nums">{c.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h4 className="text-sm font-semibold text-[#231F20]">Transaction Ledger</h4>
          <p className="text-xs text-slate-400">Chronological history across all departments & connectors</p>
        </div>
        {transactions.length === 0 ? (
          <div className="text-center py-10">
            <Receipt className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <p className="text-sm text-slate-400">No transactions linked to this entity yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/60 border-b border-slate-100 text-left">
                  <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Txn ID</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase text-right">Amount</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase hidden md:table-cell">Date</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase hidden md:table-cell">Category</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Status</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase text-center">Risk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {transactions.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/40">
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-700">{t.transaction_id || "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">{formatCurrency(t.amount, t.currency)}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-500 hidden md:table-cell">{t.transaction_date ? new Date(t.transaction_date).toLocaleDateString() : "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-500 hidden md:table-cell">{t.category || "—"}</td>
                    <td className="px-4 py-2.5"><span className="text-xs capitalize text-slate-600">{t.status || "—"}</span></td>
                    <td className="px-4 py-2.5 text-center"><RiskBadge level={t.risk_level} size="sm" showIcon={false} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}