import React, { useState, useMemo } from "react";
import { FileText, Save, Download, Loader2, ShieldCheck, Sparkles, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import ReportPreview from "@/components/investigation/ReportPreview";
import TemplateManager from "@/components/investigation/TemplateManager";
import { buildReportData, exportReportAsMarkdown } from "@/lib/reportTemplate";
import { exportReportAsPDF } from "@/lib/pdfExport";
import { useCompanyProfile } from "@/lib/CompanyProfileContext";

const outcomeOptions = [
  { value: "pending", label: "Pending — still reviewing" },
  { value: "confirmed_anomaly", label: "Confirmed anomaly" },
  { value: "false_positive", label: "False positive" },
  { value: "process_error", label: "Process error" },
  { value: "escalated", label: "Escalated to senior team" },
];

export default function StepDecision({
  investigation, alert, transaction, evidenceItems,
  aiSummary, aiConfidence, citedSignals,
  sourceRecords, complianceAnalysis, financialImpact,
  recommendations, similarCases, qaHistory,
  outcome, notes, narrative,
  generatingReport, saving,
  onOutcomeChange, onNotesChange, onGenerateReport, onSave,
}) {
  const [generatingNarrative, setGeneratingNarrative] = useState(false);
  const { profile } = useCompanyProfile();

  // Live report data — auto-fills from all wizard state as it becomes available
  const reportData = useMemo(() => buildReportData({
    investigation, alert, transaction, evidenceItems,
    aiSummary, aiConfidence, citedSignals,
    sourceRecords, complianceAnalysis, financialImpact,
    recommendations, similarCases, qaHistory,
    outcome, notes,
  }), [investigation, alert, transaction, evidenceItems, aiSummary, aiConfidence, citedSignals,
       sourceRecords, complianceAnalysis, financialImpact, recommendations, similarCases, qaHistory, outcome, notes]);

  const handleGenerateNarrative = async () => {
    setGeneratingNarrative(true);
    try {
      await onGenerateReport();
    } catch (e) {
    } finally {
      setGeneratingNarrative(false);
    }
  };

  const handleDownload = () => {
    const md = exportReportAsMarkdown(reportData, narrative || {});
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `RAVIQEN_${reportData.meta.report_id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPDF = async () => {
    await exportReportAsPDF(reportData, narrative || {}, profile);
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-bold text-[#231F20]">Step 5 — Decision & Report</h2>
        <p className="text-xs text-slate-500">Record the outcome — the standardized report auto-fills live from all wizard data</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Outcome + Notes — 2/5 */}
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-[#231F20] mb-4">Investigation Outcome</h3>
            <div className="space-y-2">
              {outcomeOptions.map((opt) => (
                <label
                  key={opt.value}
                  className={cn(
                    "flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors",
                    outcome === opt.value ? "border-slate-900 bg-slate-50" : "border-slate-200 hover:bg-slate-50"
                  )}
                >
                  <input type="radio" name="outcome-final" checked={outcome === opt.value} onChange={() => onOutcomeChange(opt.value)} className="accent-slate-900" />
                  <span className="text-xs font-medium text-slate-700">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-[#231F20] mb-3">Investigator Notes</h3>
            <textarea
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              rows={6}
              placeholder="Record your findings, context, and conclusions here..."
              className="w-full text-sm text-slate-700 p-3 rounded-lg border border-slate-200 focus:border-slate-400 focus:ring-1 focus:ring-slate-300 outline-none resize-none"
            />
            <TemplateManager notes={notes} onNotesChange={onNotesChange} />
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-4 h-4 text-slate-500" />
              <h3 className="text-sm font-semibold text-[#231F20]">Audit Trail</h3>
            </div>
            <div className="space-y-2.5 text-xs">
              <div className="flex gap-2"><span className="text-slate-400 w-24 shrink-0">Created</span><span className="text-slate-600">{investigation?.created_date ? new Date(investigation.created_date).toLocaleString() : "—"}</span></div>
              <div className="flex gap-2"><span className="text-slate-400 w-24 shrink-0">Investigator</span><span className="text-slate-600">{investigation?.investigator || "Unassigned"}</span></div>
              <div className="flex gap-2"><span className="text-slate-400 w-24 shrink-0">Risk Level</span><span className="text-slate-600 capitalize">{investigation?.risk_level}</span></div>
            </div>
          </div>

          <button
            onClick={onSave}
            disabled={saving}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving Investigation..." : "Conclude & Save Investigation"}
          </button>
        </div>

        {/* Standardized Report Preview — 3/5 */}
        <div className="lg:col-span-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-slate-500" />
              <div>
                <h3 className="text-sm font-semibold text-[#231F20]">Standardized Report Preview</h3>
                <p className="text-[11px] text-slate-400">Live template · Auto-fills from wizard data · {reportData.meta.report_id}</p>
              </div>
            </div>
            <button
              onClick={handleGenerateNarrative}
              disabled={generatingNarrative || generatingReport}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              {generatingNarrative || generatingReport ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {generatingNarrative || generatingReport ? "Generating..." : narrative ? "Regenerate Narrative" : "Generate Narrative"}
            </button>
          </div>

          <ReportPreview reportData={reportData} narrative={narrative} generating={generatingNarrative || generatingReport} />

          <div className="flex gap-2">
            <button
              onClick={handleDownloadPDF}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors"
            >
              <FileText className="w-4 h-4" />
              Export PDF Report
            </button>
            <button
              onClick={handleDownload}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              .md
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}