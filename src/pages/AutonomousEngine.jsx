import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { logActivity } from "@/lib/activityLogger";
import { runAutonomousScan } from "@/lib/autonomousEngine";
import EngineStats from "@/components/autonomous/EngineStats";
import ScanCard from "@/components/autonomous/ScanCard";
import CaseBriefing from "@/components/autonomous/CaseBriefing";
import BackToTop from "@/components/BackToTop";
import { Radar, Play, Loader2, AlertTriangle, FileSearch, Zap, ShieldCheck, Building2, Clock, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export default function AutonomousEngine() {
  const { user } = useAuth();
  const [scans, setScans] = useState([]);
  const [autoCases, setAutoCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testProgress, setTestProgress] = useState("");
  const [activeTab, setActiveTab] = useState("scans");

  const loadData = useCallback(async () => {
    try {
      const [scanData, caseData] = await Promise.all([
        base44.entities.AutonomousScan.list("-created_date", 30),
        base44.entities.Investigation.filter({ status: "open" }, "-created_date", 20),
      ]);
      setScans(scanData || []);
      // Filter to auto-generated cases (those with cited_signals or "autonomous" in title)
      setAutoCases((caseData || []).filter((c) => c.cited_signals?.length > 0 || c.title?.startsWith("Autonomous")));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    loadData();
    const unsub = base44.entities.AutonomousScan.subscribe(() => loadData());
    return unsub;
  }, [loadData]);

  const runTestScan = async () => {
    setTesting(true);
    setTestProgress("Creating historical baseline…");
    try {
      const vendorName = `Test Vendor ${Date.now().toString().slice(-6)}`;
      // Step 1: Create historical transactions to establish a baseline
      const historicalTxns = await base44.entities.Transaction.bulkCreate([
        { transaction_id: `HIST-${Date.now()}-1`, vendor: vendorName, amount: 5000, currency: "USD", transaction_date: "2025-08-01", category: "Consulting", location: "Lagos", status: "clean", risk_score: 10, risk_level: "low" },
        { transaction_id: `HIST-${Date.now()}-2`, vendor: vendorName, amount: 5500, currency: "USD", transaction_date: "2025-08-15", category: "Consulting", location: "Lagos", status: "clean", risk_score: 10, risk_level: "low" },
        { transaction_id: `HIST-${Date.now()}-3`, vendor: vendorName, amount: 4800, currency: "USD", transaction_date: "2025-08-30", category: "Consulting", location: "Lagos", status: "clean", risk_score: 10, risk_level: "low" },
      ]);

      setTestProgress("Creating entity profile…");
      // Step 2: Create entity profile with known bank account
      const profile = await base44.entities.EntityProfile.create({
        profile_id: `ENT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        legal_name: vendorName,
        trading_name: vendorName,
        entity_type: "vendor",
        bank_accounts: [{ account: "BANK-001-NGN", first_seen: "2025-08-01" }],
        address: "Lagos, Nigeria",
        country: "Nigeria",
        industry: "Consulting",
        baseline_risk_tag: "low_risk",
        status: "active",
        first_seen: "2025-08-01",
      });

      setTestProgress("Running autonomous scan on anomalous transaction…");
      // Step 3: Run the engine on a new transaction with multiple anomalies:
      // - Bank account variance (BANK-999 vs historical BANK-001)
      // - Price spike (75,000 vs avg ~5,100 — 15x)
      // - High-value threshold (>50,000)
      // - Off-hours submission
      const testRecords = [
        { transaction_id: `ANOM-${Date.now()}`, vendor: vendorName, amount: 75000, currency: "USD", transaction_date: new Date().toISOString(), category: "Consulting", location: "Lagos", bank_account: "BANK-999-XYZ" },
        // Second record: a completely new vendor (first-time entity)
        { transaction_id: `NEW-${Date.now() + 1}`, vendor: `First-Time Vendor ${Date.now().toString().slice(-4)}`, amount: 12000, currency: "USD", transaction_date: new Date().toISOString(), category: "Supplies", location: "Abuja" },
        // Third record: quarantined (missing amount)
        { transaction_id: `BAD-${Date.now() + 2}`, vendor: "Incomplete Records Co" },
      ];

      const result = await runAutonomousScan({
        records: testRecords,
        source: "manual_upload",
        filename: "test_scan_demo.csv",
        user,
        onProgress: (done, total) => setTestProgress(`Processing record ${done}/${total}…`),
      });

      await logActivity(user, "autonomous_test_scan", `Ran test scan: ${result.summary.alerts} alerts, ${result.summary.casesOpened} cases opened`, "AutonomousScan", result.scanId);
      await loadData();
      setTestProgress(`Done! ${result.summary.alerts} alerts, ${result.summary.casesOpened} cases opened, ${result.summary.newEntities} new entities.`);
    } catch (e) {
      console.error(e);
      setTestProgress(`Error: ${e.message}`);
    } finally {
      setTesting(false);
      setTimeout(() => setTestProgress(""), 5000);
    }
  };

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-slate-200 px-4 md:px-8 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center">
              <Radar className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[#231F20]">Autonomous Scanning & Investigation Engine</h1>
              <p className="text-xs text-slate-500">Global trigger · entity resolution · historical comparison · auto-alerts · dynamic case building</p>
            </div>
          </div>
          <button
            onClick={runTestScan}
            disabled={testing}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors shrink-0"
          >
            {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            {testing ? "Running…" : "Run Test Scan"}
          </button>
        </div>
        {testProgress && (
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            {testProgress}
          </div>
        )}
      </header>

      <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
        <EngineStats scans={scans} loading={loading} />

        {/* Pipeline visualization */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-[#231F20] mb-4">Autonomous Pipeline</h3>
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {[
              { icon: Zap, label: "Global Trigger", desc: "Any ingestion touchpoint" },
              { icon: Building2, label: "Entity Resolution", desc: "Single-profile persistence" },
              { icon: Clock, label: "Historical Comparison", desc: "Bank · pricing · duplicates · velocity" },
              { icon: AlertTriangle, label: "Auto-Alert", desc: "Real-time risk scoring" },
              { icon: FileSearch, label: "Case Building", desc: "Auto-open investigation" },
              { icon: ShieldCheck, label: "AI Briefing", desc: "Executive narrative + next steps" },
            ].map((step, i) => {
              const Icon = step.icon;
              return (
                <React.Fragment key={i}>
                  <div className="flex flex-col items-center gap-1.5 min-w-[120px] text-center">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-slate-600" />
                    </div>
                    <p className="text-xs font-semibold text-slate-700">{step.label}</p>
                    <p className="text-[10px] text-slate-400">{step.desc}</p>
                  </div>
                  {i < 5 && <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-slate-200">
          <button
            onClick={() => setActiveTab("scans")}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === "scans" ? "border-slate-900 text-slate-900" : "border-transparent text-slate-400 hover:text-slate-600"}`}
          >
            Scan Feed ({scans.length})
          </button>
          <button
            onClick={() => setActiveTab("cases")}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === "cases" ? "border-slate-900 text-slate-900" : "border-transparent text-slate-400 hover:text-slate-600"}`}
          >
            Auto-Built Cases ({autoCases.length})
          </button>
        </div>

        {/* Content */}
        {activeTab === "scans" && (
          <div className="space-y-3">
            {loading ? (
              [1, 2, 3].map((i) => <div key={i} className="h-20 rounded-xl bg-slate-100 animate-pulse" />)
            ) : scans.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
                <Radar className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                <h3 className="text-sm font-semibold text-slate-700 mb-1">No scans yet</h3>
                <p className="text-xs text-slate-400 mb-4">The engine triggers automatically on any data ingestion. Run a test scan to see it in action.</p>
              </div>
            ) : (
              scans.map((scan) => <ScanCard key={scan.id} scan={scan} />)
            )}
          </div>
        )}

        {activeTab === "cases" && (
          <div className="space-y-3">
            {autoCases.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
                <FileSearch className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                <h3 className="text-sm font-semibold text-slate-700 mb-1">No auto-built cases yet</h3>
                <p className="text-xs text-slate-400 mb-4">High-risk transactions automatically open investigation cases with AI executive briefings.</p>
                <Link to="/investigations" className="text-xs text-slate-600 underline">View all investigations</Link>
              </div>
            ) : (
              autoCases.map((inv) => <CaseBriefing key={inv.id} investigation={inv} />)
            )}
          </div>
        )}
      </div>
      <BackToTop />
    </div>
  );
}