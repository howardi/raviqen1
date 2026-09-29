import React, { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useCompanyProfile } from "@/lib/CompanyProfileContext";
import { logActivity } from "@/lib/activityLogger";
import ScreeningUploadZone from "@/components/ingestion/ScreeningUploadZone";
import ScreeningPipeline from "@/components/ingestion/ScreeningPipeline";
import ScreeningResultsTable from "@/components/ingestion/ScreeningResultsTable";
import ScreeningRecordDetail from "@/components/ingestion/ScreeningRecordDetail";
import BackToTop from "@/components/BackToTop";
import { extractRecordsFromFile, processBatch, persistScreeningResults, buildRiskBriefing } from "@/lib/ingestionScreening";
import RiskBriefingCard from "@/components/ingestion/RiskBriefingCard";
import { Loader2, ScanSearch, CheckCircle2, AlertTriangle, Ban, FileX, Save, Sparkles } from "lucide-react";

const PIPELINE_ORDER = ["extract", "verify", "screen", "osint", "score", "decide"];

export default function IngestionScreening() {
  const { user } = useAuth();
  const { profile } = useCompanyProfile();
  const [processing, setProcessing] = useState(false);
  const [activeStep, setActiveStep] = useState(null);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [results, setResults] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [sourceFilename, setSourceFilename] = useState("");
  const [persisting, setPersisting] = useState(false);
  const [persisted, setPersisted] = useState(false);
  const [error, setError] = useState(null);

  const handleFile = async (file) => {
    if (!file) return;
    setProcessing(true);
    setError(null);
    setResults([]);
    setPersisted(false);
    setCompletedSteps([]);
    setActiveStep("extract");

    try {
      // Step 1: Upload + Extract
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const normalizedRecords = await extractRecordsFromFile(file_url, file);

      if (normalizedRecords.length === 0) {
        setError("No records could be extracted from the uploaded file. Ensure the file contains transaction data with vendor, amount, and a reference ID.");
        setProcessing(false);
        setActiveStep(null);
        return;
      }

      setCompletedSteps(["extract"]);
      setActiveStep("verify");

      // Steps 2–6: Process each record through the full screening pipeline
      // Pass the ingesting org name so RULE-RM-04 can check invoice recipient mismatch
      const currentBaseline = await base44.entities.Transaction.list("-created_date", 500);
      const processed = await processBatch(normalizedRecords, currentBaseline, (done, total) => {
        // Progress within the verification/screening phase
      }, { orgName: profile?.company_name || null, filename: file.name });

      // Mark all pipeline steps complete
      setCompletedSteps([...PIPELINE_ORDER]);
      setActiveStep(null);
      setResults(processed);
      setSourceFilename(file.name);

      // Log activity
      await logActivity(user, "intelligent_screening", `Screened ${file.name}: ${processed.length} records processed`, "IngestionBatch", null);
    } catch (e) {
      console.error("Screening failed", e);
      setError(e.message || "Screening failed. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  const handlePersist = async () => {
    if (results.length === 0) return;
    setPersisting(true);
    try {
      // Create an ingestion batch record
      const batch = await base44.entities.IngestionBatch.create({
        filename: `Screening ${new Date().toLocaleString()}`,
        status: "completed",
        data_source: "Intelligent Screening",
        total_records: results.length,
        valid_records: results.filter((r) => r.verification_status === "valid").length,
        quarantined_records: results.filter((r) => r.verification_status === "quarantined").length,
        flagged_records: results.filter((r) => r.verification_status === "flagged").length,
      });

      const counts = await persistScreeningResults(results, batch.id, user, sourceFilename);
      setPersisted(true);
      await logActivity(user, "screening_persist", `Persisted ${counts.transactions} transactions, ${counts.alerts} alerts from screening batch ${batch.id}`, "IngestionBatch", batch.id);
    } catch (e) {
      console.error("Persist failed", e);
      setError("Failed to save results: " + (e.message || "unknown error"));
    } finally {
      setPersisting(false);
    }
  };

  const handleSelectRecord = (r) => {
    setSelectedRecord(r);
    setDetailOpen(true);
  };

  // Summary stats
  const stats = {
    total: results.length,
    valid: results.filter((r) => r.verification_status === "valid").length,
    flagged: results.filter((r) => r.verification_status === "flagged").length,
    quarantined: results.filter((r) => r.verification_status === "quarantined").length,
    avgScore: results.some((r) => Number.isFinite(r.risk_score?.total)) ? Math.round(results.reduce((s, r) => s + (r.risk_score?.total || 0), 0) / results.filter((r) => Number.isFinite(r.risk_score?.total)).length) : "—",
  };

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-slate-200 px-4 md:px-8 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center">
            <ScanSearch className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[#231F20]">Intelligent Ingestion & Risk Screening Engine</h1>
            <p className="text-xs text-slate-500">Automated extraction, background verification, and risk scoring for every ingested record</p>
          </div>
        </div>
      </header>

      <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
        {/* Upload Zone */}
        <ScreeningUploadZone onFile={handleFile} processing={processing} />

        {/* Pipeline */}
        {(processing || results.length > 0) && (
          <ScreeningPipeline activeStep={activeStep} completed={completedSteps} />
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2.5 p-4 rounded-xl bg-red-50 border border-red-200">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Summary Stats */}
        {results.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <SummaryCard icon={FileX} label="Total Records" value={stats.total} color="slate" />
            <SummaryCard icon={CheckCircle2} label="Valid" value={stats.valid} color="emerald" />
            <SummaryCard icon={AlertTriangle} label="Flagged" value={stats.flagged} color="amber" />
            <SummaryCard icon={Ban} label="Quarantined" value={stats.quarantined} color="red" />
            <SummaryCard icon={Sparkles} label="Avg Risk Score" value={stats.avgScore} color="violet" />
          </div>
        )}

        {/* Risk Briefing Summary */}
        {results.length > 0 && (
          <RiskBriefingCard briefing={buildRiskBriefing(results)} />
        )}

        {/* Results Table */}
        {results.length > 0 && (
          <>
            <ScreeningResultsTable results={results} onSelectRecord={handleSelectRecord} />
            <div className="flex justify-end">
              <button
                onClick={handlePersist}
                disabled={persisting || persisted}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {persisting ? <Loader2 className="w-4 h-4 animate-spin" /> : persisted ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                {persisting ? "Saving…" : persisted ? "Saved to Database" : "Save Results to Database"}
              </button>
              {persisted && <Link to="/ingestion-audit" className="ml-3 self-center text-sm font-medium text-blue-700 hover:underline">View saved records →</Link>}
            </div>
          </>
        )}

        {/* Empty State */}
        {!processing && results.length === 0 && !error && (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
              <ScanSearch className="w-7 h-7 text-slate-400" />
            </div>
            <h3 className="text-sm font-semibold text-slate-700 mb-1">No records screened yet</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Upload a CSV, Excel, PDF, Word document, or scanned invoice image. The engine will extract fields via OCR/NER,
              verify entities against corporate registries, screen for sanctions and PEPs, scan adverse media, detect anomalies,
              and assign a composite risk score with actionable next steps.
            </p>
          </div>
        )}
      </div>

      <ScreeningRecordDetail record={selectedRecord} open={detailOpen} onOpenChange={setDetailOpen} />
      <BackToTop />
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, color }) {
  const colorMap = {
    slate: "text-slate-700 bg-slate-100",
    emerald: "text-emerald-700 bg-emerald-100",
    amber: "text-amber-700 bg-amber-100",
    red: "text-red-700 bg-red-100",
    violet: "text-violet-700 bg-violet-100",
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${colorMap[color]}`}>
        <Icon className="w-4.5 h-4.5" />
      </div>
      <div className="min-w-0">
        <p className="text-xl font-bold text-[#231F20] tabular-nums leading-none">{value}</p>
        <p className="text-[10px] text-slate-400 uppercase tracking-wide mt-1">{label}</p>
      </div>
    </div>
  );
}