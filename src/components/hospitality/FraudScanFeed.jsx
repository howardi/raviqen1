import React, { useCallback, useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import FraudAlertCard from "@/components/hospitality/FraudAlertCard";
import FraudSignalCard from "@/components/hospitality/FraudSignalCard";
import { fraudSignalsFromTransactions } from "@/lib/fraudScanSignals";

export default function FraudScanFeed({ refreshKey }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const [alerts, transactions] = await Promise.all([
        base44.entities.FraudAlert.list("-created_date", 500),
        base44.entities.Transaction.list("-created_date", 500),
      ]);
      const operational = alerts.map((alert) => ({ id: alert.id, created_date: alert.created_date, type: "operational", alert }));
      const signals = fraudSignalsFromTransactions(transactions).map((signal) => ({ ...signal, type: "signal" }));
      setItems([...operational, ...signals].sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
      setError("");
    } catch (e) { setError(e.message || "Could not load scan findings."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    load();
    window.addEventListener("focus", load);
    const unsubscribeAlerts = base44.entities.FraudAlert.subscribe(load);
    const unsubscribeTransactions = base44.entities.Transaction.subscribe(load);
    return () => { window.removeEventListener("focus", load); unsubscribeAlerts(); unsubscribeTransactions(); };
  }, [load, refreshKey]);
  return <section aria-label="Fraud findings from saved scans" className="space-y-3">
    <div><h2 className="text-sm font-semibold text-slate-800">Fraud-related findings from saved scans</h2>
      <p className="text-xs text-slate-500">Operational alerts and source-backed transaction indicators. These are review signals, not confirmed fraud.</p></div>
    {loading && <p role="status" className="text-sm text-slate-500">Loading saved findings…</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {!loading && !error && items.length === 0 && <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">No evidence-backed fraud findings in saved scans yet.</p>}
    {!loading && items.map((item) => item.type === "operational"
      ? <FraudAlertCard key={`operational-${item.id}`} alert={item.alert} />
      : <FraudSignalCard key={`signal-${item.id}`} signal={item} />)}
  </section>;
}