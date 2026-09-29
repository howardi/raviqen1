import React from "react";
import { Radar, Loader2, MapPin, DollarSign, Globe, Users } from "lucide-react";

const reasonIcon = {
  amount: DollarSign,
  vendor: Users,
  geography: MapPin,
  currency: Globe,
};

function reasonIconFor(reason) {
  if (/amount/i.test(reason)) return DollarSign;
  if (/vendor/i.test(reason)) return Users;
  if (/jurisdiction|geography/i.test(reason)) return MapPin;
  if (/currency/i.test(reason)) return Globe;
  return Radar;
}

const confColor = (c) =>
  c >= 80 ? "bg-red-500" : c >= 60 ? "bg-orange-500" : c >= 40 ? "bg-amber-500" : "bg-slate-400";

export default function AnomalyPanel({ anomalies, loading }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center">
            <Radar className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#231F20]">Anomaly Detection</h3>
            <p className="text-xs text-slate-400">Transactions deviating from normal behavior patterns</p>
          </div>
        </div>
        {anomalies?.length > 0 && (
          <span className="text-xs font-medium text-slate-500">{anomalies.length} flagged</span>
        )}
      </div>

      <div className="mt-4 space-y-2.5">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 text-slate-300 animate-spin" />
          </div>
        ) : !anomalies || anomalies.length === 0 ? (
          <div className="text-center py-8">
            <Radar className="w-8 h-8 mx-auto text-slate-200 mb-2" />
            <p className="text-xs text-slate-400">No anomalies detected. Behavior within normal bounds.</p>
          </div>
        ) : (
          anomalies.map((a, i) => (
            <div key={i} className="rounded-lg border border-slate-100 hover:border-slate-200 p-3 transition-colors">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-xs font-mono font-medium text-slate-700 truncate">{a.transaction_id}</span>
                <span className="text-[10px] font-semibold text-slate-500 shrink-0">{a.confidence}%</span>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div className={`h-full rounded-full ${confColor(a.confidence)}`} style={{ width: `${a.confidence}%` }} />
                </div>
                <span className="text-[10px] text-slate-400 shrink-0">{a.vendor}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {a.reasons.map((r, j) => {
                  const Icon = reasonIconFor(r);
                  return (
                    <span key={j} className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-50 text-slate-600 border border-slate-100">
                      <Icon className="w-2.5 h-2.5" />
                      {r}
                    </span>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}