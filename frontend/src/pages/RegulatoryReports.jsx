import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";
import { FileText, Plus, Clock, CheckCircle2, FileEdit, Loader2, X, Sparkles, Send, Eye, Trash2, Download } from "lucide-react";
import { generateSarStrReport } from "@/lib/advancedAI";
import { buildPDFReport } from "@/lib/reportBuilder";
import MarkdownContent from "@/components/MarkdownContent";
import { useCompanyProfile } from "@/lib/CompanyProfileContext";
import { cn } from "@/lib/utils";
import { stampTenant } from "@/lib/tenantScope";

const statusConfig = {
  draft: { label: "Draft", icon: FileEdit, classes: "bg-amber-50 text-amber-700 border-amber-200" },
  submitted: { label: "Submitted", icon: CheckCircle2, classes: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  archived: { label: "Archived", icon: FileText, classes: "bg-slate-50 text-slate-600 border-slate-200" },
};

export default function RegulatoryReports() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { profile } = useCompanyProfile();
  const [downloading, setDownloading] = useState(null);
  const [reports, setReports] = useState([]);
  const [investigations, setInvestigations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showGenModal, setShowGenModal] = useState(false);
  const [selectedInv, setSelectedInv] = useState("");
  const [reportType, setReportType] = useState("SAR");
  const [generating, setGenerating] = useState(false);
  const [viewing, setViewing] = useState(null);

  const loadReports = async () => {
    try {
      const data = await base44.entities.RegulatoryReport.list("-created_date", 50);
      setReports(data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => {
    loadReports();
    base44.entities.Investigation.list("-created_date", 50).then(setInvestigations).catch(() => {});
  }, []);

  const handleGenerate = async () => {
    if (!selectedInv) { toast({ title: "Select an investigation", variant: "destructive" }); return; }
    setGenerating(true);
    try {
      const inv = investigations.find((i) => i.id === selectedInv);
      let transaction = null;
      if (inv?.transaction_id) {
        const txs = await base44.entities.Transaction.filter({ transaction_id: inv.transaction_id });
        transaction = txs[0] || null;
      }
      const result = await generateSarStrReport(inv, transaction, reportType);
      const reportId = `${reportType}-2026-${String(reports.length + 1).padStart(3, "0")}`;
      const deadline = result.recommended_deadline || new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];
      await base44.entities.RegulatoryReport.create(stampTenant({
        report_id: reportId,
        type: reportType,
        title: `${reportType} — ${inv?.vendor || inv?.title || "New Report"}`,
        status: "draft",
        content: result.report_content || "",
        filing_summary: result.filing_summary || "",
        investigation_id: inv?.id || "",
        transaction_id: inv?.transaction_id || "",
        vendor: inv?.vendor || "",
        deadline,
      }, user));
      await loadReports();
      setShowGenModal(false);
      setSelectedInv("");
      toast({ title: "Report generated", description: `${reportId} created with AI-generated content.` });
    } catch (e) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmit = async (r) => {
    try {
      await base44.entities.RegulatoryReport.update(r.id, {
        status: "submitted",
        filed_by: user?.full_name || user?.email || "Unknown",
        filed_date: new Date().toISOString().split("T")[0],
      });
      await loadReports();
      toast({ title: "Report submitted", description: `${r.report_id} has been filed.` });
    } catch (e) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async (r) => {
    try {
      await base44.entities.RegulatoryReport.delete(r.id);
      await loadReports();
      toast({ title: "Report deleted", description: `${r.report_id} has been removed.` });
    } catch (e) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleDownloadPDF = async (r) => {
    setDownloading(r.id);
    try {
      const doc = await buildPDFReport({
        title: r.title,
        content: r.content || "",
        profile,
        subtitle: `${r.type} Filing — ${r.report_id}`,
      });
      doc.save(`${r.report_id}.pdf`);
    } catch (e) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setDownloading(null);
  };

  const daysUntil = (deadline) => {
    if (!deadline) return null;
    const diff = new Date(deadline) - new Date();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-slate-200 px-4 md:px-8 py-4 sticky top-0 z-10 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#231F20]">Regulatory Reports</h1>
          <p className="text-xs text-slate-500">SAR / STR filings with AI-generated content and deadline tracking</p>
        </div>
        <button onClick={() => setShowGenModal(true)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 transition-colors">
          <Plus className="w-3.5 h-3.5" /> Generate Report
        </button>
      </header>

      <div className="p-4 md:p-8 space-y-3">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        ) : reports.length === 0 ? (
          <div className="text-center py-20">
            <FileText className="w-10 h-10 mx-auto text-slate-300 mb-3" />
            <p className="text-sm text-slate-500">No reports yet. Click "Generate Report" to create one with AI.</p>
          </div>
        ) : (
          reports.map((r) => {
            const cfg = statusConfig[r.status] || statusConfig.draft;
            const Icon = cfg.icon;
            const days = daysUntil(r.deadline);
            const overdue = days !== null && days < 0 && r.status === "draft";
            return (
              <div key={r.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4 hover:shadow-sm transition-shadow">
                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-slate-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs font-mono font-semibold text-slate-500">{r.report_id}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">{r.type}</span>
                    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium", cfg.classes)}>
                      <Icon className="w-2.5 h-2.5" /> {cfg.label}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-[#231F20] truncate">{r.title}</p>
                  <p className="text-xs text-slate-400">{r.filed_by ? `Filed by ${r.filed_by} on ${r.filed_date}` : "Not yet filed"}</p>
                </div>
                {days !== null && (
                  <div className="text-right shrink-0">
                    <div className={cn("inline-flex items-center gap-1 text-xs font-medium", overdue ? "text-red-600" : days <= 7 && r.status === "draft" ? "text-amber-600" : "text-slate-500")}>
                      <Clock className="w-3 h-3" />
                      {overdue ? `${Math.abs(days)} days overdue` : `${days} days left`}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">Deadline: {r.deadline}</p>
                  </div>
                )}
                <div className="flex items-center gap-1.5 shrink-0">
                  {r.content && (
                    <button onClick={() => setViewing(r)} className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors" title="View content">
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {r.content && (
                    <button onClick={() => handleDownloadPDF(r)} disabled={downloading === r.id} className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50 transition-colors" title="Download PDF">
                      {downloading === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                    </button>
                  )}
                  {r.status === "draft" && r.content && (
                    <button onClick={() => handleSubmit(r)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 transition-colors">
                      <Send className="w-3 h-3" /> Submit
                    </button>
                  )}
                  <button onClick={() => handleDelete(r)} className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Generate Modal */}
      {showGenModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowGenModal(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-[#231F20]">Generate Regulatory Report</h3>
              </div>
              <button onClick={() => setShowGenModal(false)} className="p-1 rounded-lg hover:bg-slate-100"><X className="w-4 h-4 text-slate-500" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Report Type</label>
                <div className="flex gap-2">
                  {["SAR", "STR", "CTR"].map((t) => (
                    <button key={t} onClick={() => setReportType(t)} className={cn("px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors", reportType === t ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50")}>{t}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Select Investigation</label>
                <select value={selectedInv} onChange={(e) => setSelectedInv(e.target.value)} className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 outline-none bg-white focus:border-slate-400">
                  <option value="">Choose an investigation...</option>
                  {investigations.map((inv) => <option key={inv.id} value={inv.id}>{inv.title} — {inv.vendor || "Unknown"}</option>)}
                </select>
              </div>
              <button onClick={handleGenerate} disabled={generating || !selectedInv} className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors">
                {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> AI generating report...</> : <><Sparkles className="w-4 h-4" /> Generate with AI</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {viewing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setViewing(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-[#231F20]">{viewing.report_id}</h3>
              <button onClick={() => setViewing(null)} className="p-1 rounded-lg hover:bg-slate-100"><X className="w-4 h-4 text-slate-500" /></button>
            </div>
            <MarkdownContent content={viewing.content || "No content generated."} />
            {viewing.filing_summary && (
              <div className="mt-4 pt-4 border-t border-slate-200">
                <p className="text-xs font-semibold text-slate-500 mb-1">Filing Summary</p>
                <p className="text-xs text-slate-600">{viewing.filing_summary}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}