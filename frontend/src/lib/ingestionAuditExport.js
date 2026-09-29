import { jsPDF } from "jspdf";

const fields = ["timestamp", "document_id", "source_reference", "entity_name", "sector", "validated_amount", "currency_iso", "formatted_amount", "risk_score", "risk_level", "verdict_summary", "status", "source_filename", "batch_id"];
const headers = ["Timestamp (UTC)", "Document ID", "Source Reference", "Entity Name", "Sector", "Validated Amount", "Currency ISO", "Formatted Amount", "Risk Score", "Risk Level", "Verdict Summary", "Status", "Source Filename", "Batch ID"];
const xmlEscape = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;").replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
const csvCell = (v) => {
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  let s = String(v ?? "");
  if (/^[\s]*[=+\-@\t\r]/.test(s)) s = "'" + s; // prevent spreadsheet formula injection
  return `"${s.replace(/"/g, '""')}"`;
};
const asRows = (records) => records.map((r) => fields.map((key) => r[key] ?? ""));
function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Minimal ZIP writer (stored entries) for a real OOXML workbook, without a CDN or CSV masquerading as XLSX.
const encoder = new TextEncoder();
function crc32(data) {
  let crc = -1;
  for (const byte of data) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ -1) >>> 0;
}
function zip(files) {
  const parts = [], central = [];
  let offset = 0;
  for (const [name, content] of files) {
    const key = encoder.encode(name), body = encoder.encode(content), crc = crc32(body);
    const header = new Uint8Array(30 + key.length), dv = new DataView(header.buffer);
    dv.setUint32(0, 0x04034b50, true); dv.setUint16(4, 20, true);
    dv.setUint32(14, crc, true); dv.setUint32(18, body.length, true); dv.setUint32(22, body.length, true);
    dv.setUint16(26, key.length, true); header.set(key, 30);
    parts.push(header, body);
    const dir = new Uint8Array(46 + key.length), cd = new DataView(dir.buffer);
    cd.setUint32(0, 0x02014b50, true); cd.setUint16(4, 20, true); cd.setUint16(6, 20, true);
    cd.setUint32(16, crc, true); cd.setUint32(20, body.length, true); cd.setUint32(24, body.length, true);
    cd.setUint16(28, key.length, true); cd.setUint32(42, offset, true); dir.set(key, 46);
    central.push(dir); offset += header.length + body.length;
  }
  const end = new Uint8Array(22), e = new DataView(end.buffer);
  const directorySize = central.reduce((sum, entry) => sum + entry.length, 0);
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
  e.setUint32(12, directorySize, true); e.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
export function buildTabularWorkbook(columnHeaders, rows, sheetName, numericColumns = []) {
  const rowXml = [columnHeaders, ...rows].map((row, index) => `<row r="${index + 1}">${row.map((value, column) => {
    let n = column + 1, letter = "";
    while (n > 0) { letter = String.fromCharCode(65 + (n - 1) % 26) + letter; n = Math.floor((n - 1) / 26); }
    const numeric = index > 0 && numericColumns.includes(column) && value !== "" && value != null && Number.isFinite(Number(value));
    return numeric ? `<c r="${letter}${index + 1}"><v>${Number(value)}</v></c>` : `<c r="${letter}${index + 1}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
  }).join("")}</row>`).join("");
  return zip([
    ["[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`],
    ["_rels/.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ["xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xmlEscape(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`],
    ["xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`],
    ["xl/worksheets/sheet1.xml", `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rowXml}</sheetData></worksheet>`],
  ]);
}
export function buildAuditWorkbook(records) {
  return buildTabularWorkbook(headers, asRows(records), "Ingestion Audit", [5, 8]);
}

function amountImage(text) {
  const canvas = document.createElement("canvas");
  canvas.width = 650; canvas.height = 32;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, 650, 32);
  ctx.fillStyle = "#172033"; ctx.font = "20px Arial, sans-serif";
  ctx.fillText(text, 2, 24);
  return canvas.toDataURL("image/png");
}
function pdf(records, filename) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const w = doc.internal.pageSize.getWidth(), h = doc.internal.pageSize.getHeight();
  let y = 58;
  const text = (s, x, pos, max = 120) => doc.text(String(s ?? "").replace(/[^\x20-\x7E]/g, "?"), x, pos, { maxWidth: max });
  const header = () => {
    doc.setFont("helvetica", "bold"); doc.setFontSize(15); text("RAVIQEN  |  Ingestion Audit Log", 28, 31, w - 56);
    doc.setFontSize(8); doc.setFont("helvetica", "normal");
    text("UTC timestamp", 28, 50); text("Document ID", 145, 50); text("Entity", 245, 50);
    text("Sector", 370, 50); text("Amount", 470, 50); text("Risk", 608, 50); text("Status", 670, 50);
  };
  header();
  for (const r of records) {
    const summary = doc.splitTextToSize(String(r.verdict_summary || "").replace(/[^\x20-\x7E]/g, "?"), w - 65);
    const lines = Math.max(1, summary.length);
    const rowHeight = 37 + lines * 11;
    if (y + rowHeight > h - 35) { doc.addPage(); header(); y = 58; }
    doc.setDrawColor(225, 230, 235); doc.line(28, y - 5, w - 28, y - 5);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8);
    text(r.timestamp || "", 28, y + 8, 112); text(r.source_reference || r.document_id, 145, y + 8, 95);
    text(r.entity_name, 245, y + 8, 120); text(r.sector, 370, y + 8, 95);
    doc.addImage(amountImage(r.formatted_amount), "PNG", 470, y - 1, 128, 10);
    text(`${r.currency_iso} ${r.validated_amount ?? ""}`, 470, y + 19, 130);
    text(`${r.risk_score ?? "—"}/100 ${String(r.risk_level).toUpperCase()}`, 608, y + 8, 60);
    text(r.status, 670, y + 8, 145);
    doc.setTextColor(80, 90, 105); text(`ID: ${r.document_id}  |  Verdict: ${summary.join(" ")}`, 35, y + 32, w - 70); doc.setTextColor(0, 0, 0);
    y += rowHeight;
  }
  const count = doc.internal.getNumberOfPages();
  for (let i = 1; i <= count; i++) { doc.setPage(i); doc.setFontSize(8); text(`Page ${i} of ${count}  |  ${records.length} records`, 28, h - 15, w - 56); }
  doc.save(filename);
}

export function exportIngestionAudit(records, format, scope) {
  const filename = `RAVIQEN_Ingestion_Audit_${scope}_${new Date().toISOString().slice(0, 10)}.${format}`;
  if (format === "xlsx") saveBlob(buildAuditWorkbook(records), filename);
  else if (format === "csv") saveBlob(new Blob(["\uFEFF", [headers.map(csvCell).join(","), ...asRows(records).map((row) => row.map(csvCell).join(","))].join("\r\n")], { type: "text/csv;charset=utf-8" }), filename);
  else if (format === "json") saveBlob(new Blob([JSON.stringify(records.map(({ id, ...row }) => row), null, 2)], { type: "application/json" }), filename);
  else if (format === "pdf") pdf(records, filename);
}