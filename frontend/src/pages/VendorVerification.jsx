import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { ShieldCheck, UserSearch, FileCheck, AlertTriangle, Loader, IdCard, Building2, Users } from "lucide-react";
import { runVendorKYB, computeIdentityScore, VERIFICATION_STATUS_CONFIG } from "@/lib/vendorVerification";
import StatCard from "@/components/StatCard";
import BackToTop from "@/components/BackToTop";
import { useToast } from "@/components/ui/use-toast";

export default function VendorVerification() {
  const { toast } = useToast();
  const [transactions, setTransactions] = useState([]);
  const [verifications, setVerifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [vendorInput, setVendorInput] = useState("");
  const [selectedVendor, setSelectedVendor] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [txData, verData] = await Promise.all([
          base44.entities.Transaction.list("-created_date", 100).catch(() => []),
          base44.entities.VendorVerification.list("-created_date", 20).catch(() => []),
        ]);
        setTransactions(txData);
        setVerifications(verData);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const uniqueVendors = useMemo(() => {
    const vendors = new Set(transactions.map((t) => t.vendor).filter(Boolean));
    return Array.from(vendors);
  }, [transactions]);

  const handleVerify = async (vendor) => {
    const target = vendor || selectedVendor || vendorInput;
    if (!target) return;
    setVerifying(true);
    try {
      const result = await runVendorKYB(target, { verifiedBy: "System" });
      await base44.entities.VendorVerification.create(result);
      setVerifications((prev) => [result, ...prev]);
      toast({ title: "KYB Verification Complete", description: `${target}: ${result.verification_status.toUpperCase()} (score ${result.identity_score})` });
      setVendorInput("");
      setSelectedVendor("");
    } catch (err) {
      toast({ title: "Verification failed", description: err.message, variant: "destructive" });
    } finally {
      setVerifying(false);
    }
  };

  const stats = {
    total: verifications.length,
    verified: verifications.filter((v) => v.verification_status === "verified").length,
    flagged: verifications.filter((v) => v.verification_status === "flagged").length,
    rejected: verifications.filter((v) => v.verification_status === "rejected").length,
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
          <IdCard className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Vendor Identity Verification</h1>
          <p className="text-sm text-slate-500">KYC/KYB verification with sanctions screening, PEP checks, and beneficial ownership analysis</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Verifications" value={stats.total} icon={UserSearch} accent="blue" />
        <StatCard label="Verified" value={stats.verified} icon={ShieldCheck} accent="emerald" />
        <StatCard label="Flagged" value={stats.flagged} icon={AlertTriangle} accent="amber" />
        <StatCard label="Rejected" value={stats.rejected} icon={Building2} accent="red" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <UserSearch className="w-4 h-4 text-violet-500" />
          New Vendor Verification
        </h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={vendorInput}
            onChange={(e) => setVendorInput(e.target.value)}
            placeholder="Enter vendor name to verify..."
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
            onClick={() => handleVerify()}
            disabled={verifying || (!vendorInput && !selectedVendor)}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {verifying ? <><Loader className="w-4 h-4 animate-spin" /> Verifying...</> : <><FileCheck className="w-4 h-4" /> Run KYB Check</>}
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-2">Uses web search to verify business registration, beneficial owners, sanctions, and PEP status</p>
      </div>

      <div className="space-y-4">
        <h3 className="font-semibold text-slate-800">Verification History</h3>
        {verifications.length === 0 ? (
          <div className="text-center py-12 text-slate-400 bg-white rounded-xl border border-slate-200">
            <IdCard className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No verifications yet. Run a KYB check to see results here.</p>
          </div>
        ) : (
          verifications.map((v, i) => {
            const cfg = VERIFICATION_STATUS_CONFIG[v.verification_status] || VERIFICATION_STATUS_CONFIG.pending;
            const score = v.identity_score || computeIdentityScore(v);
            return (
              <div key={v.id || i} className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-slate-800">{v.vendor}</h4>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${cfg.classes}`}>{cfg.label}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {v.verification_date ? new Date(v.verification_date).toLocaleDateString() : "Recent"} · {v.country_of_incorporation || "Unknown"}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-slate-800">{score}</div>
                    <div className="text-xs text-slate-400">Identity Score</div>
                  </div>
                </div>

                <div className="grid sm:grid-cols-3 gap-3 mb-4">
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-400 mb-1">Sanctions Check</p>
                    <span className={`text-sm font-medium ${v.sanctions_check === "clear" ? "text-emerald-600" : v.sanctions_check === "match" ? "text-red-600" : "text-slate-500"}`}>
                      {v.sanctions_check === "clear" ? "✓ Clear" : v.sanctions_check === "match" ? "✗ Match" : v.sanctions_check === "partial_match" ? "⚠ Partial" : "Not checked"}
                    </span>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-400 mb-1">PEP Check</p>
                    <span className={`text-sm font-medium ${v.pep_check === "clear" ? "text-emerald-600" : v.pep_check === "match" ? "text-red-600" : "text-slate-500"}`}>
                      {v.pep_check === "clear" ? "✓ Clear" : v.pep_check === "match" ? "✗ Match" : "Not checked"}
                    </span>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-400 mb-1">Registration #</p>
                    <span className="text-sm font-medium text-slate-700">{v.registration_number || "Not found"}</span>
                  </div>
                </div>

                {v.beneficial_owners && v.beneficial_owners.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1"><Users className="w-3 h-3" /> Beneficial Owners</p>
                    <div className="space-y-1">
                      {v.beneficial_owners.map((owner, j) => (
                        <div key={j} className="flex items-center justify-between text-sm bg-slate-50 rounded-lg px-3 py-2">
                          <span className="text-slate-700">{owner.name}</span>
                          <div className="flex items-center gap-3 text-xs text-slate-500">
                            <span>{owner.ownership_percentage}%</span>
                            <span>{owner.nationality}</span>
                            {owner.pep_status === "match" && <span className="text-red-600 font-medium">PEP</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {v.risk_assessment && (
                  <div className="bg-violet-50 rounded-lg p-3 border border-violet-100">
                    <p className="text-xs font-semibold text-violet-700 mb-1">AI Risk Assessment:</p>
                    <p className="text-sm text-slate-700">{v.risk_assessment}</p>
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