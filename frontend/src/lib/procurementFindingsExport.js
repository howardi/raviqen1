import { jsPDF } from "jspdf";
import { buildTabularWorkbook } from "@/lib/ingestionAuditExport";

const columns = [
  ["Transaction ID", "transaction_id"], ["Vendor", "vendor"], ["Batch ID", "batch_id"],
  ["Transaction Currency", "currency"], ["Transaction Amount", "amount"],
  ["Overall Procurement Risk", "overall_risk"], ["Recommended Action", "recommended_action"],
  ["Item", "item_description"], ["Quantity", "quantity"], ["Quoted Unit Price", "quoted_unit_price"],
  ["Unit Price (NGN)", "invoice_unit_price"], ["Cited Market Unit Price (NGN)", "nigerian_market_avg"],
  ["Price Variance", "calculated_variance_percent"], ["Rule", "flagged_rule"],
  ["Arithmetic Finding", "arithmetic_finding"], ["Finding Status", "status"],
  ["Comparison", "comparison"], ["Market Basis", "market_basis"],
  ["Market Source URL", "market_source_url"], ["Confidence", "confidence"],
  ["Market Note", "market_note"], ["FX Basis", "fx_basis"],
];

export function procurementExportRows(transactions) {
  return transactions.flatMap((t) => {
    const pv = t.procurement_variance || {};
    return (pv.market_variance_analysis || []).map((item) => ({
      transaction_id: t.transaction_id, vendor: t.vendor, batch_id: t.batch_id,
      currency: t.currency, amount: t.amount,
      overall_risk: pv.overall_procurement_risk,
      recommended_action: pv.recommended_action,
      market_note: pv.market_note, fx_basis: pv.fx_basis,
      item_description: item.item_description, quantity: item.quantity,
      quoted_unit_price: item.quoted_unit_price, invoice_unit_price: item.invoice_unit_price,
      nigerian_market_avg: item.nigerian_market_avg,
      calculated_variance_percent: item.calculated_variance_percent,
      flagged_rule: item.arithmetic_finding ? "RULE-PG-04" : item.flagged_rule,
      arithmetic_finding: item.arithmetic_finding, status: item.status,
      comparison: item.comparison, market_basis: item.market_basis,
      market_source_url: item.market_source_url, confidence: item.confidence,
    }));
  });
}

function save(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvCell(value) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  let text = String(value ?? "");
  if (/^\s*[=+\-@\t\r]/.test(text)) text = "'" + text;
  return `"${text.replace(/"/g, '""')}"`;
}

function exportPdf(rows, filename) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const margin = 40;
  let y = 60;
  const safe = (text) => String(text ?? "").replace(/₦/g, "NGN ").replace(/[×]/g, "x").replace(/[^\x20-\x7E]/g, " ");
  const heading = () => {
    doc.setFont("helvetica", "bold"); doc.setFontSize(14);
    doc.text("RAVIQEN | Procurement Findings", margin, 35);
    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    doc.text(`${rows.length} line-item findings`, width - margin, 35, { align: "right" });
  };
  const write = (text, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(9);
    for (const line of doc.splitTextToSize(safe(text), width - margin * 2)) {
      if (y > height - 45) { doc.addPage(); heading(); y = 60; }
      doc.text(line, margin, y); y += 13;
    }
  };
  heading();
  for (const r of rows) {
    if (y > height - 175) { doc.addPage(); heading(); y = 60; }
    doc.setDrawColor(220, 226, 235); doc.line(margin, y, width - margin, y); y += 16;
    write(`${r.transaction_id} | ${r.vendor} | ${r.currency || "Currency unknown"} ${r.amount ?? "Amount unavailable"}`, true);
    write(`Item: ${r.item_description} | Qty: ${r.quantity} | Quoted: ${r.quoted_unit_price}`);
    write(`Risk: ${r.overall_risk} | Rule: ${r.flagged_rule || "No priced comparison"} | Variance: ${r.calculated_variance_percent}`);
    write(`Market: ${r.nigerian_market_avg} | Basis: ${r.market_basis || "Not available"}`);
    if (r.market_source_url) write(`Source: ${r.market_source_url}`);
    if (r.arithmetic_finding) write(`Arithmetic: ${r.arithmetic_finding}`);
    write(`Comparison: ${r.comparison || r.status || "Not assessed"}`);
    write(`Action: ${r.recommended_action || "Review source document"}`);
    y += 8;
  }
  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i); doc.setFontSize(8); doc.text(`Page ${i} of ${pages}`, width - margin, height - 20, { align: "right" });
  }
  doc.save(filename);
}

export function exportProcurementFindings(transactions, format, batchId = "") {
  const rows = procurementExportRows(transactions);
  if (!rows.length) throw new Error("There are no line-item findings to export.");
  const filename = `RAVIQEN_Procurement_Findings_${batchId ? "Batch_" + batchId + "_" : ""}${new Date().toISOString().slice(0, 10)}.${format}`;
  if (format === "pdf") return exportPdf(rows, filename);
  if (format === "json") {
    const records = transactions.map((t) => ({
      transaction_id: t.transaction_id, vendor: t.vendor, batch_id: t.batch_id,
      currency: t.currency, amount: t.amount,
      procurement_variance: {
        overall_procurement_risk: t.procurement_variance.overall_procurement_risk,
        recommended_action: t.procurement_variance.recommended_action,
        fx_basis: t.procurement_variance.fx_basis,
        market_note: t.procurement_variance.market_note,
        market_variance_analysis: t.procurement_variance.market_variance_analysis || [],
      },
    }));
    return save(new Blob([JSON.stringify(records, null, 2)], { type: "application/json" }), filename);
  }
  const headers = columns.map(([label]) => label);
  const values = rows.map((r) => columns.map(([, key]) => r[key] ?? ""));
  if (format === "xlsx") return save(buildTabularWorkbook(headers, values, "Procurement Findings", [4, 8]), filename);
  if (format === "csv") return save(new Blob(["\uFEFF", [headers.map(csvCell).join(","), ...values.map((v) => v.map(csvCell).join(","))].join("\r\n")], { type: "text/csv;charset=utf-8" }), filename);
  throw new Error("Unsupported export format.");
}