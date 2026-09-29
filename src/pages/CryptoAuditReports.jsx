import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Lock, Hash, ShieldCheck, ShieldAlert, FileText, Download, CheckCircle, XCircle } from "lucide-react";
import { buildHashChain, verifyHashChain, generateReportManifest } from "@/lib/cryptoAudit";
import StatCard from "@/components/StatCard";
import BackToTop from "@/components/BackToTop";
import { useToast } from "@/components/ui/use-toast";

export default function CryptoAuditReports() {
  const { toast } = useToast();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chained, setChained] = useState([]);
  const [verification, setVerification] = useState(null);
  const [building, setBuilding] = useState(false);
  const [manifest, setManifest] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await base44.entities.AuditLogEntry.list("-created_date", 200);
        setLogs(data);
      } catch {
        setLogs([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleBuildChain = async () => {
    if (logs.length === 0) return;
    setBuilding(true);
    try {
      const chain = await buildHashChain(logs);
      setChained(chain);
      const verify = await verifyHashChain(chain);
      setVerification(verify);
      const m = generateReportManifest(chain, verify);
      setManifest(m);
      toast({ title: "Hash chain built", description: `${chain.length} entries chained with SHA-256` });
    } catch (err) {
      toast({ title: "Failed to build chain", description: err.message, variant: "destructive" });
    } finally {
      setBuilding(false);
    }
  };

  const handleExportReport = () => {
    if (!chained.length) return;
    const report = {
      manifest,
      entries: chained.map((e) => ({
        id: e.id,
        user: e.user,
        action: e.action,
        detail: e.detail,
        entity_type: e.entity_type,
        entity_id: e.entity_id,
        ip_address: e.ip_address,
        created_date: e.created_date,
        hash: e.hash,
        prev_hash: e.prev_hash,
      })),
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `crypto-audit-report-${manifest?.report_id || Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Report exported", description: "Cryptographic audit report downloaded" });
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
          <Lock className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Cryptographic Audit Reports</h1>
          <p className="text-sm text-slate-500">Tamper-evident, hash-chained audit trail with SHA-256 integrity verification</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Audit Entries" value={logs.length} icon={FileText} accent="blue" />
        <StatCard label="Chain Length" value={chained.length} icon={Hash} accent="purple" />
        <StatCard label="Unique Users" value={manifest?.unique_users ?? "—"} icon={ShieldCheck} accent="emerald" />
        <StatCard label="Chain Status" value={verification ? (verification.valid ? "Valid" : "Broken") : "—"} icon={verification?.valid ? CheckCircle : ShieldAlert} accent={verification?.valid ? "emerald" : "red"} />
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleBuildChain}
          disabled={building || logs.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
        >
          <Hash className="w-4 h-4" />
          {building ? "Building Chain..." : "Build Hash Chain"}
        </button>
        <button
          onClick={handleExportReport}
          disabled={!chained.length}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors"
        >
          <Download className="w-4 h-4" />
          Export Crypto Report
        </button>
      </div>

      {manifest && (
        <div className="bg-slate-900 rounded-xl p-5 text-white">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-violet-400" />
            <h3 className="font-semibold">Report Manifest — {manifest.report_id}</h3>
          </div>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <div className="flex justify-between"><span className="text-slate-400">Generated:</span><span>{new Date(manifest.generated_at).toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Algorithm:</span><span>{manifest.algorithm}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Standard:</span><span className="text-right">{manifest.standard}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Entry Count:</span><span>{manifest.entry_count}</span></div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between"><span className="text-slate-400">Chain Valid:</span>
                <span className="flex items-center gap-1">
                  {manifest.chain_valid ? <><CheckCircle className="w-4 h-4 text-emerald-400" /> Valid</> : <><XCircle className="w-4 h-4 text-red-400" /> Broken at #{manifest.broken_at}</>}
                </span>
              </div>
              <div className="flex justify-between"><span className="text-slate-400">Genesis Hash:</span><span className="font-mono text-xs text-violet-300 truncate max-w-[200px]">{manifest.genesis_hash?.substring(0, 24)}...</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Head Hash:</span><span className="font-mono text-xs text-violet-300 truncate max-w-[200px]">{manifest.head_hash?.substring(0, 24)}...</span></div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <Hash className="w-4 h-4 text-violet-500" />
            Hash-Chained Audit Entries
          </h3>
          {verification && (
            <span className={`text-xs px-2.5 py-1 rounded-full ${verification.valid ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
              {verification.valid ? "✓ Chain Verified" : "✗ Chain Broken"}
            </span>
          )}
        </div>
        {chained.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Lock className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Click "Build Hash Chain" to generate a tamper-evident audit trail</p>
          </div>
        ) : (
          <div className="max-h-[500px] overflow-y-auto">
            <div className="overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">#</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">User</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Action</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Timestamp</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Hash (SHA-256)</th>
                  <th className="text-center px-4 py-2 font-medium text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {chained.slice(0, 50).map((entry, i) => (
                  <tr key={entry.id || i} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-2 text-slate-400 text-xs">{i + 1}</td>
                    <td className="px-4 py-2 text-slate-700 text-xs">{entry.user || "—"}</td>
                    <td className="px-4 py-2 text-slate-700 text-xs">{entry.action}</td>
                    <td className="px-4 py-2 text-slate-400 text-xs">{entry.created_date ? new Date(entry.created_date).toLocaleString() : "—"}</td>
                    <td className="px-4 py-2 font-mono text-xs text-violet-600">{entry.hash?.substring(0, 20)}...</td>
                    <td className="px-4 py-2 text-center">
                      {entry.verified ? <CheckCircle className="w-4 h-4 text-emerald-500 mx-auto" /> : <XCircle className="w-4 h-4 text-red-500 mx-auto" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {chained.length > 50 && (
             <div className="px-4 py-3 text-center text-xs text-slate-400 border-t border-slate-100">
               Showing 50 of {chained.length} entries — export for full report
             </div>
            )}
            </div>
            </div>
        )}
      </div>

      <BackToTop />
    </div>
  );
}