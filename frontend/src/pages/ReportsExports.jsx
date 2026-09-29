import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { FileText, FileSpreadsheet, FileType, Loader2, Calendar, Sparkles } from "lucide-react";
import { generateReportContent } from "@/lib/advancedAI";
import { buildPDFReport, buildCSVReport, downloadCSV } from "@/lib/reportBuilder";
import GoogleSheetsExport from "@/components/GoogleSheetsExport";
import { useCompanyProfile } from "@/lib/CompanyProfileContext";
import MarkdownContent from "@/components/MarkdownContent";
import { cn } from "@/lib/utils";

const templates = [
  { id: "exec_summary", name: "Executive Summary Report", desc: "High-level risk overview for leadership" },
  { id: "investigation", name: "Investigation Report", desc: "Full standardized 13-section investigation output" },
  { id: "sar_str", name: "SAR / STR Filing", desc: "Regulatory filing document with required fields" },
  { id: "risk_assessment", name: "Risk Assessment Report", desc: "Comprehensive risk scoring and factor analysis" },
  { id: "compliance", name: "Compliance Audit Report", desc: "Framework compliance status and gaps" },
];

const formatOptions = [
  { id: "pdf", label: "PDF", icon: FileType, desc: "Formatted document for sharing" },
  { id: "csv", label: "CSV", icon: FileSpreadsheet, desc: "Spreadsheet-compatible data export" },
  { id: "excel", label: "Excel", icon: FileSpreadsheet, desc: "Formatted spreadsheet" },
];

export default function ReportsExports() {
  const { toast } = useToast();
  const { profile } = useCompanyProfile();
  const [selectedTemplate, setSelectedTemplate] = useState("exec_summary");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [format, setFormat] = useState("pdf");
  const [exporting, setExporting] = useState(false);
  const [generatedContent, setGeneratedContent] = useState("");

  const handleExport = async () => {
    setExporting(true);
    setGeneratedContent("");
    try {
      const [transactions, alerts, investigations] = await Promise.all([
        base44.entities.Transaction.list("-created_date", 100),
        base44.entities.Alert.list("-created_date", 50),
        base44.entities.Investigation.list("-created_date", 50),
      ]);
      const content = await generateReportContent(selectedTemplate, { transactions, alerts, investigations, dateFrom, dateTo });
      setGeneratedContent(content);

      const tpl = templates.find((t) => t.id === selectedTemplate);
      const companyName = profile?.company_name || "RAVIQEN";

      if (format === "pdf") {
        const doc = await buildPDFReport({ title: tpl.name, content, profile, subtitle: "Risk & Compliance Report" });
        doc.save(`${companyName}_${selectedTemplate}_${Date.now()}.pdf`);
      } else {
        const csv = buildCSVReport({ title: tpl.name, content, profile });
        downloadCSV(csv, `${companyName}_${selectedTemplate}_${Date.now()}.${format === "excel" ? "xls" : "csv"}`, format === "excel");
      }
      toast({ title: "Report exported", description: `${tpl.name} exported as ${format.toUpperCase()} with ${companyName} branding.` });
    } catch (e) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-slate-200 px-4 md:px-8 py-4 sticky top-0 z-10">
        <h1 className="text-lg font-bold text-[#231F20]">Reports & Exports</h1>
        <p className="text-xs text-slate-500">AI-powered report generation with company branding</p>
      </header>

      <div className="p-4 md:p-8 max-w-3xl space-y-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-[#231F20] mb-4">Report Template</h3>
          <div className="space-y-2">
            {templates.map((t) => (
              <label key={t.id} className={cn("flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors", selectedTemplate === t.id ? "border-slate-900 bg-slate-50" : "border-slate-200 hover:bg-slate-50")}>
                <input type="radio" name="template" checked={selectedTemplate === t.id} onChange={() => setSelectedTemplate(t.id)} className="accent-slate-900" />
                <div className="flex-1"><p className="text-sm font-medium text-slate-700">{t.name}</p><p className="text-xs text-slate-400">{t.desc}</p></div>
                <FileText className="w-4 h-4 text-slate-400" />
              </label>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-semibold text-[#231F20]">Date Range</h3>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="text-sm px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-slate-400 flex-1 min-w-[120px]" />
            <span className="text-xs text-slate-400">to</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="text-sm px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-slate-400 flex-1 min-w-[120px]" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-[#231F20] mb-4">Export Format</h3>
          <div className="grid grid-cols-3 gap-3">
            {formatOptions.map((f) => {
              const Icon = f.icon;
              return (
                <button key={f.id} onClick={() => setFormat(f.id)} className={cn("p-4 rounded-lg border text-center transition-colors", format === f.id ? "border-slate-900 bg-slate-50" : "border-slate-200 hover:bg-slate-50")}>
                  <Icon className={cn("w-6 h-6 mx-auto mb-2", format === f.id ? "text-slate-900" : "text-slate-400")} />
                  <p className="text-sm font-semibold text-slate-700">{f.label}</p>
                  <p className="text-[10px] text-slate-400">{f.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        <GoogleSheetsExport />

        <button onClick={handleExport} disabled={exporting} className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors">
          {exporting ? <><Loader2 className="w-4 h-4 animate-spin" /> AI generating & exporting...</> : <><Sparkles className="w-4 h-4" /> Generate & Export Report</>}
        </button>

        {generatedContent && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-[#231F20] mb-3">Generated Report Preview</h3>
            <div className="max-h-96 overflow-y-auto border border-slate-100 rounded-lg p-4">
              <MarkdownContent content={generatedContent} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}