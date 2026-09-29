import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { ArrowLeft, AlertTriangle, ChevronLeft, ChevronRight, Check, ArrowUp, FileText, FileSpreadsheet, Loader2 } from "lucide-react";
import RiskBadge, { RiskScoreRing } from "@/components/RiskBadge";
import WizardProgress, { STEPS } from "@/components/investigation/WizardProgress";
import StepEvidence from "@/components/investigation/StepEvidence";
import StepAISummary from "@/components/investigation/StepAISummary";
import StepCrossRef from "@/components/investigation/StepCrossRef";
import StepAIAnalyst from "@/components/investigation/StepAIAnalyst";
import StepDecision from "@/components/investigation/StepDecision";
import {
  generateRiskSummary, generateRecommendations, detectSimilarCases,
  answerInvestigationQuestion, generateComplianceAnalysis, generateFinancialImpact,
} from "@/lib/investigationAI";
import { generateReportNarrative, buildReportData } from "@/lib/reportTemplate";
import { exportReportAsPDF } from "@/lib/pdfExport";
import { buildInvestigationsCSV } from "@/lib/sheetsExport";
import { downloadCSV } from "@/lib/reportBuilder";
import { useCompanyProfile } from "@/lib/CompanyProfileContext";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

export default function InvestigationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useCompanyProfile();
  const [exporting, setExporting] = useState(false);
  const [investigation, setInvestigation] = useState(null);
  const [alert, setAlert] = useState(null);
  const [transaction, setTransaction] = useState(null);
  const [allInvestigations, setAllInvestigations] = useState([]);
  const [loading, setLoading] = useState(true);

  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState([]);

  // AI state
  const [aiSummary, setAiSummary] = useState("");
  const [aiConfidence, setAiConfidence] = useState("medium");
  const [citedSignals, setCitedSignals] = useState([]);
  const [summaryAcknowledged, setSummaryAcknowledged] = useState(false);
  const [generatingSummary, setGeneratingSummary] = useState(false);

  const [recommendations, setRecommendations] = useState([]);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [similarCases, setSimilarCases] = useState([]);
  const [loadingSimilar, setLoadingSimilar] = useState(false);
  const [qaHistory, setQaHistory] = useState([]);
  const [loadingQA, setLoadingQA] = useState(false);

  const [complianceAnalysis, setComplianceAnalysis] = useState(null);
  const [loadingCompliance, setLoadingCompliance] = useState(false);
  const [financialImpact, setFinancialImpact] = useState(null);
  const [loadingFinancial, setLoadingFinancial] = useState(false);

  const [sourceRecords, setSourceRecords] = useState([]);
  const [loadingLookup, setLoadingLookup] = useState(false);

  const [notes, setNotes] = useState("");
  const [outcome, setOutcome] = useState("pending");
  const [reportNarrative, setReportNarrative] = useState(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [saving, setSaving] = useState(false);

  const connectionStatus = {
    quickbooks: { connected: false, needsUpgrade: true },
    ezee_burrp: { connected: false, needsUpgrade: true },
  };

  const evidenceItems = useMemo(() => {
    const flags = alert?.flag_reasons || [];
    const items = [
      { label: "Amount deviation", value: "+340% vs vendor history", severity: "high" },
      { label: "Timestamp anomaly", value: "Off-hours transaction (02:14 AM)", severity: "medium" },
      { label: "Vendor risk profile", value: "New vendor, no payment history", severity: "high" },
      { label: "Geographic flag", value: "Payment routed via high-risk jurisdiction", severity: "critical" },
    ];
    if (flags.length) {
      return items.map((it, i) => i < flags.length ? { ...it, value: flags[i] || it.value } : it);
    }
    return items;
  }, [alert]);

  useEffect(() => {
    (async () => {
      try {
        const inv = await base44.entities.Investigation.get(id);
        setInvestigation(inv);
        setNotes(inv.notes || "");
        setOutcome(inv.outcome || "pending");
        setAiSummary(inv.ai_explanation || "");
        setCurrentStep(inv.wizard_step || 1);
        if (inv.recommended_actions) setRecommendations(inv.recommended_actions.map((a) => (typeof a === "string" ? { action: a, priority: "medium", rationale: "" } : a)));
        if (inv.similar_cases) setSimilarCases(inv.similar_cases);
        if (inv.qa_history) setQaHistory(inv.qa_history);
        if (inv.cross_ref_results) setSourceRecords(inv.cross_ref_results);
        if (inv.compliance_analysis) setComplianceAnalysis(inv.compliance_analysis);
        if (inv.financial_impact) setFinancialImpact(inv.financial_impact);
        if (inv.report_narrative) setReportNarrative(inv.report_narrative);
        if (inv.ai_confidence) setAiConfidence(inv.ai_confidence);
        if (inv.cited_signals) setCitedSignals(inv.cited_signals);

        if (inv.alert_id) {
          try { setAlert(await base44.entities.Alert.get(inv.alert_id)); } catch (e) {}
        }
        // Find matching transaction
        try {
          const txs = await base44.entities.Transaction.filter({ transaction_id: inv.transaction_id }, "-created_date", 1);
          if (txs.length) setTransaction(txs[0]);
        } catch (e) {}
        // Load all investigations for similar-case detection
        try { setAllInvestigations(await base44.entities.Investigation.list("-created_date", 50)); } catch (e) {}
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const completeStep = (step) => setCompletedSteps((prev) => prev.includes(step) ? prev : [...prev, step]);

  const canAdvance = (step) => {
    if (step === 1) return completedSteps.includes(1);
    if (step === 2) return !!aiSummary && summaryAcknowledged;
    if (step === 3) return sourceRecords.length > 0 && sourceRecords.every((r) => r.match_status !== "pending");
    if (step === 4) return true;
    return true;
  };

  const handleNext = () => {
    completeStep(currentStep);
    if (currentStep < STEPS.length) {
      const next = currentStep + 1;
      setCurrentStep(next);
      base44.entities.Investigation.update(id, { wizard_step: next, status: "in_progress" }).catch(() => {});
    }
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleStepClick = (step) => {
    if (completedSteps.includes(step) || step <= currentStep) setCurrentStep(step);
  };

  // Step 2: Generate AI summary
  const handleGenerateSummary = async () => {
    setGeneratingSummary(true);
    try {
      const res = await generateRiskSummary(investigation, alert, evidenceItems);
      setAiSummary(res.summary || "");
      setAiConfidence(res.confidence || "medium");
      setCitedSignals(res.cited_signals || []);
    } catch (e) {
      setAiSummary("Unable to generate summary at this time.");
    } finally {
      setGeneratingSummary(false);
    }
  };

  // Step 3: Cross-reference lookup (sample data — QuickBooks/Ezee Burrp require Builder+)
  const handleLookup = async (sourceType) => {
    setLoadingLookup(true);
    await new Promise((r) => setTimeout(r, 800));
    const vendor = transaction?.vendor || investigation?.vendor || "Unknown";
    const amount = transaction?.amount || alert?.amount || 0;
    const date = transaction?.transaction_date || "2026-08-20";

    let newRecords = [];
    if (sourceType === "quickbooks") {
      newRecords = [
        { source_type: "quickbooks", record_type: "invoice", external_id: `QB-INV-${Math.floor(Math.random() * 90000 + 10000)}`, vendor, amount, record_date: date, match_status: "pending", details: "Invoice found matching vendor name" },
        { source_type: "quickbooks", record_type: "bill", external_id: `QB-BILL-${Math.floor(Math.random() * 90000 + 10000)}`, vendor, amount: Math.round(amount * 0.85), record_date: date, match_status: "pending", details: "Bill amount discrepancy detected" },
        { source_type: "quickbooks", record_type: "payment", external_id: `QB-PMT-${Math.floor(Math.random() * 90000 + 10000)}`, vendor, amount, record_date: date, match_status: "pending", details: "Payment record matches" },
      ];
    } else {
      newRecords = [
        { source_type: "ezee_burrp", record_type: "sale", external_id: `EB-SALE-${Math.floor(Math.random() * 90000 + 10000)}`, vendor: "Walk-in Customer", amount: Math.round(amount * 0.1), record_date: date, match_status: "pending", details: "POS sale — no matching large transaction" },
        { source_type: "ezee_burrp", record_type: "receipt", external_id: `EB-RCPT-${Math.floor(Math.random() * 90000 + 10000)}`, vendor: "Corporate Account", amount: Math.round(amount * 0.05), record_date: date, match_status: "pending", details: "Receipt found for related entity" },
      ];
    }
    setSourceRecords((prev) => [...prev, ...newRecords]);
    setLoadingLookup(false);
  };

  const handleMarkRecord = (record, status) => {
    setSourceRecords((prev) => prev.map((r) =>
      (r.id || r.external_id) === (record.id || record.external_id) ? { ...r, match_status: status } : r
    ));
  };

  // Step 4: AI features
  const handleGenerateRecs = async () => {
    setLoadingRecs(true);
    try {
      const crossRefSummary = sourceRecords.map((r) => `${r.source_type} ${r.record_type}: ${r.match_status}`).join("; ");
      const res = await generateRecommendations(investigation, alert, evidenceItems, crossRefSummary);
      setRecommendations(res.recommendations || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingRecs(false);
    }
  };

  const handleGenerateSimilar = async () => {
    setLoadingSimilar(true);
    try {
      const res = await detectSimilarCases(investigation, alert, allInvestigations);
      setSimilarCases(res.similar_cases || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSimilar(false);
    }
  };

  const handleAsk = async (question) => {
    setLoadingQA(true);
    setQaHistory((prev) => [...prev, { question, answer: "..." }]);
    try {
      const res = await answerInvestigationQuestion(question, investigation, alert, evidenceItems, sourceRecords);
      setQaHistory((prev) => prev.map((qa, i) => i === prev.length - 1 ? { question, answer: res.answer || "Unable to answer." } : qa));
    } catch (e) {
      setQaHistory((prev) => prev.map((qa, i) => i === prev.length - 1 ? { question, answer: "Unable to answer at this time." } : qa));
    } finally {
      setLoadingQA(false);
    }
  };

  // Step 4 (advanced): Compliance impact
  const handleGenerateCompliance = async () => {
    setLoadingCompliance(true);
    try {
      const res = await generateComplianceAnalysis(investigation, alert, evidenceItems);
      setComplianceAnalysis(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingCompliance(false);
    }
  };

  // Step 4 (advanced): Financial impact
  const handleGenerateFinancial = async () => {
    setLoadingFinancial(true);
    try {
      const res = await generateFinancialImpact(investigation, alert, transaction, evidenceItems);
      setFinancialImpact(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingFinancial(false);
    }
  };

  // Step 5: Generate report narrative (executive summary + conclusion) — structure auto-fills from data
  const handleGenerateReport = async () => {
    setGeneratingReport(true);
    try {
      const { buildReportData } = await import("@/lib/reportTemplate");
      const reportData = buildReportData({
        investigation, alert, transaction, evidenceItems,
        aiSummary, aiConfidence, citedSignals,
        sourceRecords, complianceAnalysis, financialImpact,
        recommendations, similarCases, qaHistory, outcome, notes,
      });
      const narrative = await generateReportNarrative(reportData);
      setReportNarrative(narrative);
      return narrative;
    } catch (e) {
      return { executive_summary: "Unable to generate narrative at this time.", conclusion: "" };
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleQuickExportPDF = async () => {
    setExporting(true);
    try {
      const reportData = buildReportData({
        investigation, alert, transaction, evidenceItems,
        aiSummary, aiConfidence, citedSignals,
        sourceRecords, complianceAnalysis, financialImpact,
        recommendations, similarCases, qaHistory, outcome, notes,
      });
      let narrativeToUse = reportNarrative;
      if (!narrativeToUse) {
        narrativeToUse = await generateReportNarrative(reportData);
        setReportNarrative(narrativeToUse);
      }
      await exportReportAsPDF(reportData, narrativeToUse || {}, profile);
      toast({ title: "Report exported", description: "PDF report generated with company branding." });
    } catch (e) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const handleQuickExportSheets = () => {
    try {
      const csv = buildInvestigationsCSV([investigation]);
      downloadCSV(csv, `RAVIQEN_Investigation_${investigation.transaction_id || id}_${Date.now()}.csv`, false);
      toast({ title: "Exported to CSV", description: "Downloaded — open in Google Sheets via File → Import." });
    } catch (e) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.entities.Investigation.update(id, {
        notes, outcome,
        ai_explanation: aiSummary,
        ai_confidence: aiConfidence,
        cited_signals: citedSignals,
        wizard_step: currentStep,
        recommended_actions: recommendations,
        similar_cases: similarCases,
        qa_history: qaHistory,
        cross_ref_results: sourceRecords,
        compliance_analysis: complianceAnalysis,
        financial_impact: financialImpact,
        report_narrative: reportNarrative,
        status: outcome !== "pending" ? "concluded" : "in_progress",
      });
      navigate("/investigations");
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="h-8 w-48 bg-slate-100 rounded animate-pulse mb-6" />
        <div className="h-16 bg-slate-100 rounded-xl animate-pulse mb-6" />
        <div className="h-96 bg-slate-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!investigation) {
    return (
      <div className="p-8 text-center">
        <AlertTriangle className="w-10 h-10 mx-auto text-slate-300 mb-3" />
        <p className="text-sm text-slate-500">Investigation not found.</p>
        <Link to="/investigations" className="text-sm text-blue-600 mt-2 inline-block">Back to investigations</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 md:px-8 py-4">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 mb-2">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Investigations
        </button>
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 mb-1 flex-wrap">
              <h1 className="text-lg font-bold text-[#231F20]">{investigation.title}</h1>
              <RiskBadge level={investigation.risk_level} size="sm" />
            </div>
            <p className="text-xs text-slate-500 font-mono truncate">{investigation.transaction_id} · {investigation.vendor}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={handleQuickExportPDF}
              disabled={exporting}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
              Export PDF
            </button>
            <button
              onClick={handleQuickExportSheets}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-slate-700 text-xs font-medium hover:bg-slate-50 transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              Export to Sheets
            </button>
            <RiskScoreRing score={alert?.risk_score || 78} level={investigation.risk_level} size={64} />
          </div>
        </div>
      </header>

      {/* Wizard progress */}
      <WizardProgress currentStep={currentStep} completedSteps={completedSteps} onStepClick={handleStepClick} />

      {/* Step content */}
      <div className="p-4 md:p-8 pb-24">
        {currentStep === 1 && (
          <StepEvidence
            investigation={investigation} alert={alert} transaction={transaction}
            evidenceItems={evidenceItems}
            onReviewed={() => completeStep(1)}
          />
        )}
        {currentStep === 2 && (
          <StepAISummary
            summary={aiSummary} confidence={aiConfidence} citedSignals={citedSignals}
            generating={generatingSummary} onGenerate={handleGenerateSummary}
            acknowledged={summaryAcknowledged}
            onAcknowledge={() => setSummaryAcknowledged(true)}
          />
        )}
        {currentStep === 3 && (
          <StepCrossRef
            sourceRecords={sourceRecords} loading={loadingLookup}
            onLookup={handleLookup} onMarkRecord={handleMarkRecord}
            connectionStatus={connectionStatus}
          />
        )}
        {currentStep === 4 && (
          <StepAIAnalyst
            recommendations={recommendations} similarCases={similarCases} qaHistory={qaHistory}
            loadingRecs={loadingRecs} loadingSimilar={loadingSimilar} loadingQA={loadingQA}
            complianceAnalysis={complianceAnalysis} financialImpact={financialImpact}
            loadingCompliance={loadingCompliance} loadingFinancial={loadingFinancial}
            onGenerateRecs={handleGenerateRecs} onGenerateSimilar={handleGenerateSimilar} onAsk={handleAsk}
            onGenerateCompliance={handleGenerateCompliance} onGenerateFinancial={handleGenerateFinancial}
            currency={transaction?.currency || alert?.currency}
          />
        )}
        {currentStep === 5 && (
          <StepDecision
            investigation={investigation} alert={alert} transaction={transaction} evidenceItems={evidenceItems}
            aiSummary={aiSummary} aiConfidence={aiConfidence} citedSignals={citedSignals}
            sourceRecords={sourceRecords} complianceAnalysis={complianceAnalysis} financialImpact={financialImpact}
            recommendations={recommendations} similarCases={similarCases} qaHistory={qaHistory}
            outcome={outcome} notes={notes}
            narrative={reportNarrative}
            generatingReport={generatingReport} saving={saving}
            onOutcomeChange={setOutcome} onNotesChange={setNotes}
            onGenerateReport={handleGenerateReport} onSave={handleSave}
          />
        )}
      </div>

      {/* Back to top */}
      <div className="flex justify-center pb-8">
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors shadow-md"
        >
          <ArrowUp className="w-4 h-4" />
          Back to Top
        </button>
      </div>

      {/* Navigation footer */}
      {currentStep < 5 && (
        <div className="fixed bottom-0 left-0 md:left-64 right-0 bg-white border-t border-slate-200 px-4 md:px-8 py-3 flex items-center justify-between z-20">
          <button
            onClick={handleBack}
            disabled={currentStep === 1}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          <div className="flex items-center gap-3">
            {!canAdvance(currentStep) && (
              <span className="text-xs text-slate-400">Complete this step to continue</span>
            )}
            <button
              onClick={handleNext}
              disabled={!canAdvance(currentStep)}
              className={cn(
                "inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-medium transition-colors",
                canAdvance(currentStep) ? "bg-slate-900 text-white hover:bg-slate-800" : "bg-slate-200 text-slate-400 cursor-not-allowed"
              )}
            >
              {currentStep === 4 ? "Go to Decision" : "Next Step"}
              {currentStep === 4 ? <Check className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}