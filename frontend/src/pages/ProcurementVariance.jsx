import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { ShoppingCart, Upload, Loader2, FileX, TrendingUp, ChevronDown, ChevronRight, ShieldCheck, AlertTriangle, ShieldX } from "lucide-react";
import ItemMarketReport from "@/components/procurement/ItemMarketReport";
import ProcurementExportToolbar from "@/components/procurement/ProcurementExportToolbar";
import { cn } from "@/lib/utils";
import { analyzeProcurementVariance } from "@/lib/procurementVariance";
import RiskBadge from "@/components/RiskBadge";
import BackToTop from "@/components/BackToTop";

export default function ProcurementVariance() {
  const batchId = new URLSearchParams(window.location.search).get("batch") || "";
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [liveNote, setLiveNote] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const checkedIds = useRef(new Set());

  useEffect(() => {
    (async () => {
      try {
        const all = await base44.entities.Transaction.list("-created_date", 200);
        setTransactions((all || []).filter((t) => t.procurement_variance && (!batchId || t.batch_id === batchId)));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [batchId]);

  useEffect(() => {
    const pending = transactions.filter((row) => {
      const items = row.procurement_variance?.market_variance_analysis || [];
      return items.length > 0 && items.every((item) => !item.market_source_url) && !checkedIds.current.has(row.id);
    }).slice(0, 8);
    if (!pending.length || loading) return undefined;
    let cancelled = false;
    (async () => {
      setLiveNote(`Checking ${pending.length} live listing${pending.length === 1 ? "" : "s"}. A price is kept only when it is printed on the fetched page.`);
      for (const row of pending) {
        if (cancelled) return;
        checkedIds.current.add(row.id);
        try {
          const next = await analyzeProcurementVariance(row, { skipMarket: false });
          if (!next || cancelled) continue;
          const stored = { ...next };
          delete stored._analysis;
          await base44.entities.Transaction.update(row.id, { procurement_variance: stored });
          setTransactions((current) => current.map((item) => item.id === row.id ? { ...item, procurement_variance: stored } : item));
        } catch (error) {
          if (!cancelled) setLiveNote(error.message || "Live market check failed. No price was estimated.");
        }
      }
      if (!cancelled) setLiveNote("Live check finished. Variances appear only for prices found on the cited page.");
    })();
    return () => { cancelled = true; };
  }, [loading]);

  const stats = transactions.reduce(
    (acc, t) => {
      const lvl = t.procurement_variance?.overall_procurement_risk || "LOW";
      if (lvl === "CRITICAL") acc.critical++;
      else if (lvl === "MEDIUM") acc.medium++;
      else if (lvl === "LOW") acc.cleared++;
      else acc.insufficient++;
      return acc;
    },
    { total: transactions.length, cleared: 0, medium: 0, critical: 0, insufficient: 0 }
  );

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-slate-200 px-4 md:px-8 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-lg font-bold text-[#231F20] flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-slate-700" />
              Procurement Pricing & Market Variance Engine
            </h1>
            <p className="text-xs text-slate-500">
              Item-by-item quoted pricing, invoice arithmetic, and cited market comparisons when available
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <ProcurementExportToolbar transactions={transactions} batchId={batchId} loading={loading} />
            <Link
              to="/ingestion"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors shadow-sm"
            >
              <Upload className="w-4 h-4" />
              Ingest Data
            </Link>
          </div>
        </div>
      </header>

      <div className="p-4 md:p-8 space-y-6">
        {/* Summary stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="Procurement Records" value={stats.total} icon={ShoppingCart} tone="bg-slate-100 text-slate-700" />
          <StatCard label="Within threshold (PG-01)" value={stats.cleared} icon={ShieldCheck} tone="bg-emerald-50 text-emerald-700" />
          <StatCard label="Price Review (PG-02)" value={stats.medium} icon={AlertTriangle} tone="bg-amber-50 text-amber-700" />
          <StatCard label="Critical Review" value={stats.critical} icon={ShieldX} tone="bg-red-50 text-red-700" />
          <StatCard label="No cited comparison" value={stats.insufficient} icon={FileX} tone="bg-slate-100 text-slate-700" />
        </div>

        {/* Info banner */}
        <div className="flex items-start gap-2.5 p-4 rounded-xl bg-blue-50/60 border border-blue-100">
          <TrendingUp className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700">
            {liveNote ? `${liveNote} ` : ""}
            Invoices, receipts, purchase orders and itemized spreadsheets ingested via the{" "}
            <Link to="/ingestion" className="font-semibold underline">Data Ingestion</Link> page are automatically
            checked item by item for invoice arithmetic and source-backed anomalies. Bulk scans do not invent market prices; items without a cited comparable listing remain unpriced rather than cleared. Findings require human review, not automatic fraud conclusions.
          </p>
        </div>

        {/* Records table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-10 flex flex-col items-center gap-3">
              <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
              <p className="text-xs text-slate-400">Loading procurement analyses…</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="p-12 text-center">
              <FileX className="w-10 h-10 mx-auto text-slate-300 mb-3" />
              <p className="text-sm font-medium text-slate-600">No procurement analyses yet</p>
              <p className="text-xs text-slate-400 mt-1 mb-4">
                Ingest an invoice, receipt, purchase order or spreadsheet with item descriptions and quoted prices to generate an item-by-item report.
              </p>
              <Link
                to="/ingestion"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors"
              >
                <Upload className="w-4 h-4" />
                Ingest Procurement Data
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {transactions.map((t) => {
                const pv = t.procurement_variance || {};
                const items = pv.market_variance_analysis || [];
                const expanded = expandedId === t.id;
                const overall = pv.overall_procurement_risk || "LOW";
                return (
                  <div key={t.id}>
                    <button
                      onClick={() => setExpandedId(expanded ? null : t.id)}
                      className="w-full flex items-center gap-3 p-4 hover:bg-slate-50/60 transition-colors text-left"
                    >
                      <div className="shrink-0">
                        {expanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[#231F20] truncate">{t.vendor}</p>
                        <p className="text-xs text-slate-400 font-mono truncate">{t.transaction_id}</p>
                      </div>
                      <div className="hidden sm:block text-xs text-slate-500">
                        {items.length} line item{items.length !== 1 ? "s" : ""}
                      </div>
                      {overall === "INSUFFICIENT_DATA" ? <span className="rounded-full bg-slate-100 text-slate-700 px-2 py-1 text-xs">Insufficient data</span> : <RiskBadge level={overall === "CRITICAL" ? "critical" : overall === "MEDIUM" ? "medium" : "low"} size="sm" />}
                    </button>

                    {expanded && (
                      <div className="px-4 pb-4 space-y-3">
                        {pv.fx_basis && (
                          <p className="text-[11px] text-slate-400 italic">{pv.fx_basis}</p>
                        )}
                        {pv.market_note && <p className="text-xs text-slate-600">{pv.market_note}</p>}
                        <div className="space-y-2">
                          {items.map((item, i) => <ItemMarketReport key={i} item={item} />)}
                        </div>
                        <div className="pt-2 border-t border-slate-200">
                          <p className="text-[10px] font-semibold text-slate-400 uppercase">Overall Procurement Risk</p>
                          <p className={cn("text-sm font-bold", overall === "CRITICAL" ? "text-red-600" : overall === "MEDIUM" ? "text-amber-600" : overall === "INSUFFICIENT_DATA" ? "text-slate-600" : "text-emerald-600")}>
                            {overall}
                          </p>
                          <p className="text-xs text-slate-600 mt-1">{pv.recommended_action}</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <BackToTop />
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between">
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", tone)}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-2xl font-bold text-[#231F20] tabular-nums">{value}</span>
      </div>
      <p className="text-xs text-slate-500 mt-2">{label}</p>
    </div>
  );
}