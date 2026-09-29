import React, { useState, useEffect } from "react";
import { aggregateTransactions, computeBaselineMetrics } from "@/lib/entityIntelligence";
import { Loader2, Clock, Tag } from "lucide-react";
import { fetchFxRates } from "@/lib/currencyUtils";
import { Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const PIE_COLORS = ["#1e293b", "#475569", "#94a3b8", "#cbd5e1", "#e2e8f0"];

export default function EntityBaselinePanel({ profile }) {
  const [baseline, setBaseline] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!profile?.id) return;
      try {
        const txns = await aggregateTransactions(profile);
        const rates = await fetchFxRates();
        setBaseline(computeBaselineMetrics(txns, rates));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [profile?.id]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-slate-300 animate-spin" /></div>;
  if (!baseline || baseline.total_invoices === 0) return <div className="text-center py-10 text-sm text-slate-400">No baseline data — no transactions linked yet</div>;

  const categoryData = (profile.typical_categories || baseline.typical_categories || []).map((cat) => {
    const count = baseline.currency_distribution?.length || 0;
    return { name: cat, value: 1 };
  });

  return (
    <div className="space-y-4">
      {/* Standard Hours */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-slate-500" />
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Standard Transaction Hours</h4>
        </div>
        <div className="flex flex-wrap gap-2">
          {(profile.standard_hours || baseline.standard_hours || []).map((h) => (
            <span key={h} className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-100 text-xs font-medium text-slate-700">{h}</span>
          ))}
          {baseline.standard_hours?.length === 0 && <span className="text-xs text-slate-400">No time data available</span>}
        </div>
      </div>

      {/* Typical Categories */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Tag className="w-4 h-4 text-slate-500" />
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Typical Invoice Categories</h4>
        </div>
        <div className="flex flex-wrap gap-2">
          {(profile.typical_categories || baseline.typical_categories || []).map((cat) => (
            <span key={cat} className="px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-100 text-xs font-medium text-blue-700">{cat}</span>
          ))}
          {baseline.typical_categories?.length === 0 && <span className="text-xs text-slate-400">No category data available</span>}
        </div>
      </div>

      {/* Currency Distribution Chart */}
      {baseline.currency_distribution?.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Currency Distribution</h4>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={baseline.currency_distribution} dataKey="count" nameKey="currency" cx="50%" cy="50%" outerRadius={70} label={(e) => e.currency}>
                {baseline.currency_distribution.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}