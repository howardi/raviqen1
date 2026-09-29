import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { FileSpreadsheet, Loader2, ShieldCheck, FileText } from "lucide-react";
import { downloadCSV } from "@/lib/reportBuilder";
import { buildAuditReportsCSV, buildInvestigationsCSV } from "@/lib/sheetsExport";

export default function GoogleSheetsExport() {
  const { toast } = useToast();
  const [busy, setBusy] = useState(null); // "reports" | "investigations"

  const exportReports = async () => {
    setBusy("reports");
    try {
      const reports = await base44.entities.RegulatoryReport.list("-created_date", 200);
      const csv = buildAuditReportsCSV(reports);
      downloadCSV(csv, `RAVIQEN_Audit_Reports_${Date.now()}.csv`, false);
      toast({
        title: "Audit reports exported",
        description: `${reports.length} report(s) downloaded. In Google Sheets, use File → Import → Upload to open and share it.`,
      });
    } catch (e) {
      toast({ title: "Export failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const exportInvestigations = async () => {
    setBusy("investigations");
    try {
      const investigations = await base44.entities.Investigation.list("-created_date", 200);
      const csv = buildInvestigationsCSV(investigations);
      downloadCSV(csv, `RAVIQEN_Investigation_Outcomes_${Date.now()}.csv`, false);
      toast({
        title: "Investigation outcomes exported",
        description: `${investigations.length} case(s) downloaded. In Google Sheets, use File → Import → Upload to open and share it.`,
      });
    } catch (e) {
      toast({ title: "Export failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center gap-2 mb-1">
        <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
        <h3 className="text-sm font-semibold text-[#231F20]">Export to Google Sheets</h3>
      </div>
      <p className="text-xs text-slate-500 mb-4">
        Download your processed audit reports and investigation outcomes as a CSV that opens directly in
        Google Sheets. In Sheets, use <span className="font-medium text-slate-600">File → Import → Upload</span> to
        drop it into a new spreadsheet you can share.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={exportReports}
          disabled={!!busy}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 disabled:opacity-50 transition-colors"
        >
          {busy === "reports" ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4 text-emerald-600" />}
          Audit Reports
        </button>
        <button
          onClick={exportInvestigations}
          disabled={!!busy}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 disabled:opacity-50 transition-colors"
        >
          {busy === "investigations" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4 text-blue-600" />}
          Investigation Outcomes
        </button>
      </div>
    </div>
  );
}