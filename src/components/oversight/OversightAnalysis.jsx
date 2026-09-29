import React, { useState } from "react";
import { base44 } from "@/api/base44Client";

export default function OversightAnalysis({ department, label }) {
  const [insights, setInsights] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const analyze = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await base44.functions.invoke("analyzeOversightReports", department ? { department } : {});
      setInsights(res.findings || []);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h2 className="font-bold text-slate-900">{label} analysis</h2>
          <p className="text-xs text-slate-500">Server-side AI on manager-ingested records only</p>
        </div>
        <button onClick={analyze} disabled={busy} className="rounded-lg bg-slate-900 px-3 py-2 text-xs text-white disabled:opacity-50">
          {busy ? "Analyzing…" : "Run AI analysis"}
        </button>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      {insights.length > 0 && (
        <div className="mt-5 space-y-2">
          <h3 className="text-sm font-semibold">Source-linked findings</h3>
          {insights.map((f, i) => (
            <div key={i} className="rounded-lg bg-slate-50 p-3 text-sm">
              <p>{f.observation}</p>
              <p className="mt-1 text-xs text-slate-500">Source: {f.source_id} · Follow up: {f.follow_up || "Review with department"}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
