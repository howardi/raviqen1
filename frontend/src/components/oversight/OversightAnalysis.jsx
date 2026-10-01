import React, { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { BRAND_PROMISE } from "@/lib/oversight";
import { mandateFromFinding } from "@/lib/riskMandate";
import { analyzeOversightLive } from "@/lib/oversightAnalysis";

export default function OversightAnalysis({ department, label }) {
  const { user } = useAuth();
  const [insights, setInsights] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const analyze = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await analyzeOversightLive({ department, tenantId: user?.tenant_id });
      setInsights(res.findings || []);
      setError(res.error || res.note || "");
    } catch (e) {
      setError(e.message || "Analysis failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h2 className="font-bold text-slate-900">{label} analysis</h2>
          <p className="text-xs text-slate-500">Scans ingested records for unusual transactions, control gaps, procurement irregularities, financial anomalies, and operational exceptions.</p>
        </div>
        <button onClick={analyze} disabled={busy} className="rounded-lg bg-slate-900 px-3 py-2 text-xs text-white disabled:opacity-50">
          {busy ? "Analyzing…" : "Run AI analysis"}
        </button>
      </div>
      {error && insights.length === 0 && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      {error && insights.length > 0 && <p className="mt-3 text-sm text-slate-600">{error}</p>}
      {insights.length > 0 && (
        <div className="mt-5 space-y-2">
          <h3 className="text-sm font-semibold">Source-linked findings</h3>
          {insights.map((f, i) => {
            const mandate = mandateFromFinding(f, label);
            return (
              <div key={i} className="rounded-lg bg-slate-50 p-3 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{mandate.category}</p>
                <p className="mt-2"><span className="font-semibold">What requires attention. </span>{mandate.attention}</p>
                <p className="mt-1"><span className="font-semibold">Where it matters. </span>{mandate.where}</p>
                <p className="mt-1"><span className="font-semibold">When to act. </span>{mandate.when}</p>
                <p className="mt-1 text-xs text-slate-500">Source: {f.source_id || "ingested record"}</p>
              </div>
            );
          })}
        </div>
      )}
      <p className="mt-4 text-xs text-slate-500">{BRAND_PROMISE}</p>
    </section>
  );
}
