// CSV builders for exporting processed audit reports (RegulatoryReport) and
// investigation outcomes (Investigation) into a format Google Sheets opens
// natively (File → Import → Upload, or just open the .csv).

function csvCell(v) {
  if (v == null) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCSV(columns, records) {
  const header = columns.map((c) => c[0]).join(",");
  const body = (records || [])
    .map((r) => columns.map((c) => csvCell(r[c[1]])).join(","))
    .join("\r\n");
  return `${header}\r\n${body}`;
}

const AUDIT_COLUMNS = [
  ["Report ID", "report_id"],
  ["Type", "type"],
  ["Title", "title"],
  ["Status", "status"],
  ["Vendor", "vendor"],
  ["Filed By", "filed_by"],
  ["Filed Date", "filed_date"],
  ["Deadline", "deadline"],
  ["Investigation ID", "investigation_id"],
  ["Transaction ID", "transaction_id"],
  ["Filing Summary", "filing_summary"],
  ["Content", "content"],
];

const INVESTIGATION_COLUMNS = [
  ["Title", "title"],
  ["Transaction ID", "transaction_id"],
  ["Vendor", "vendor"],
  ["Status", "status"],
  ["Outcome", "outcome"],
  ["Risk Level", "risk_level"],
  ["AI Confidence", "ai_confidence"],
  ["AI Explanation", "ai_explanation"],
  ["Cited Signals", "cited_signals"],
  ["Evidence Summary", "evidence_summary"],
  ["Investigator", "investigator"],
  ["Notes", "notes"],
  ["Follow-up Date", "follow_up_date"],
  ["Report URL", "report_url"],
  ["Created Date", "created_date"],
];

export function buildAuditReportsCSV(reports) {
  return toCSV(AUDIT_COLUMNS, reports);
}

export function buildInvestigationsCSV(investigations) {
  return toCSV(INVESTIGATION_COLUMNS, investigations);
}