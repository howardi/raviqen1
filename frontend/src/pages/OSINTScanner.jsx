import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Globe, Search, AlertTriangle, Newspaper, ExternalLink, Loader, ShieldCheck, Ban } from "lucide-react";
import { scanVendorAdverseMedia, SEVERITY_CONFIG } from "@/lib/osintScanner";
import StatCard from "@/components/StatCard";
import BackToTop from "@/components/BackToTop";
import { useToast } from "@/components/ui/use-toast";

export default function OSINTScanner() {
  const { toast } = useToast();
  const [transactions, setTransactions] = useState([]);
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [vendorInput, setVendorInput] = useState("");
  const [selectedVendor, setSelectedVendor] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [txData, scanData] = await Promise.all([
          base44.entities.Transaction.list("-created_date", 100).catch(() => []),
          base44.entities.AdverseMediaScan.list("-created_date", 20).catch(() => []),
        ]);
        setTransactions(txData);
        setScans(scanData);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const uniqueVendors = useMemo(() => {
    const vendors = new Set(transactions.map((t) => t.vendor).filter(Boolean));
    return Array.from(vendors);
  }, [transactions]);

  const handleScan = async (vendor) => {
    const target = vendor || selectedVendor || vendorInput;
    if (!target) return;
    setScanning(true);
    try {
      const result = await scanVendorAdverseMedia(target, { scannedBy: "System" });
      await base44.entities.AdverseMediaScan.create(result);
      setScans((prev) => [result, ...prev]);
      toast({
        title: "OSINT Scan Complete",
        description: `${target}: ${result.findings_count} findings — ${result.risk_rating.toUpperCase()}`,
      });
      setVendorInput("");
      setSelectedVendor("");
    } catch (err) {
      toast({ title: "Scan failed", description: err.message, variant: "destructive" });
    } finally {
      setScanning(false);
    }
  };

  const stats = {
    total: scans.length,
    critical: scans.filter((s) => s.risk_rating === "critical").length,
    high: scans.filter((s) => s.risk_rating === "high").length,
    clear: scans.filter((s) => s.risk_rating === "clear").length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center">
          <Globe className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">OSINT Adverse Media Scanner</h1>
          <p className="text-sm text-slate-500">Open-source intelligence screening for negative news, sanctions, and regulatory risks</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Scans" value={stats.total} icon={Search} accent="blue" />
        <StatCard label="Critical Risk" value={stats.critical} icon={Ban} accent="red" />
        <StatCard label="High Risk" value={stats.high} icon={AlertTriangle} accent="orange" />
        <StatCard label="Clear" value={stats.clear} icon={ShieldCheck} accent="emerald" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Search className="w-4 h-4 text-violet-500" />
          New Adverse Media Scan
        </h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={vendorInput}
            onChange={(e) => setVendorInput(e.target.value)}
            placeholder="Enter vendor or entity name..."
            className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          {uniqueVendors.length > 0 && (
            <select
              value={selectedVendor}
              onChange={(e) => { setSelectedVendor(e.target.value); setVendorInput(""); }}
              className="px-4 py-2.5 rounded-lg border border-slate-200 text-sm bg-white"
            >
              <option value="">Or select existing vendor...</option>
              {uniqueVendors.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          )}
          <button
            onClick={() => handleScan()}
            disabled={scanning || (!vendorInput && !selectedVendor)}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {scanning ? <><Loader className="w-4 h-4 animate-spin" /> Scanning...</> : <><Search className="w-4 h-4" /> Run OSINT Scan</>}
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-2">Uses live web search to find adverse media, sanctions listings, and regulatory actions</p>
      </div>

      <div className="space-y-4">
        <h3 className="font-semibold text-slate-800">Scan History</h3>
        {scans.length === 0 ? (
          <div className="text-center py-12 text-slate-400 bg-white rounded-xl border border-slate-200">
            <Globe className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No scans yet. Run an OSINT scan to see results here.</p>
          </div>
        ) : (
          scans.map((scan, i) => {
            const cfg = SEVERITY_CONFIG[scan.risk_rating] || SEVERITY_CONFIG.clear;
            return (
              <div key={scan.id || i} className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-slate-800">{scan.vendor}</h4>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${cfg.classes}`}>{cfg.label}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {new Date(scan.scan_date).toLocaleString()} · {scan.findings_count} findings · {scan.categories?.join(", ") || "no categories"}
                    </p>
                  </div>
                </div>

                {scan.summary && (
                  <div className="bg-slate-50 rounded-lg p-3 mb-3">
                    <p className="text-sm text-slate-700">{scan.summary}</p>
                  </div>
                )}

                {scan.findings && scan.findings.length > 0 && (
                  <div className="space-y-2">
                    {scan.findings.slice(0, 5).map((f, j) => {
                      const fcfg = SEVERITY_CONFIG[f.severity] || SEVERITY_CONFIG.low;
                      return (
                        <div key={j} className="flex items-start gap-3 border border-slate-100 rounded-lg p-3">
                          <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${fcfg.dot}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-slate-800">{f.headline}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${fcfg.classes}`}>{f.severity}</span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">{f.summary}</p>
                            <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                              <span className="flex items-center gap-1"><Newspaper className="w-3 h-3" />{f.source}</span>
                              {f.date && <span>{f.date}</span>}
                              {f.url && <a href={f.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-violet-600 hover:underline"><ExternalLink className="w-3 h-3" />Source</a>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {scan.recommended_action && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <p className="text-xs font-semibold text-violet-600">Recommended Action:</p>
                    <p className="text-sm text-slate-600 mt-1">{scan.recommended_action}</p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <BackToTop />
    </div>
  );
}