// Source-backed procurement checks that never require a speculative market price.
export function inspectProcurementRow(record, batchRows = []) {
  const findings = [];
  const emit = (type, severity, title, detail, evidence_field, evidence_value) =>
    findings.push({ type, severity, title, detail, evidence_field, evidence_value: String(evidence_value) });
  const quantity = Number(record.quantity);
  const unitPrice = Number(record.unit_price);
  const total = Number(record.amount);
  const currency = record.currency || "currency unspecified";
  if (quantity > 0 && unitPrice > 0 && Number.isFinite(total)) {
    const expected = Math.round(quantity * unitPrice * 100) / 100;
    if (Math.abs(total - expected) > Math.max(0.01, Math.abs(expected) * 0.01)) {
      emit("RULE-PG-04", "critical", "Invoice arithmetic discrepancy",
        `Quoted total ${currency} ${total} differs from ${quantity} × ${currency} ${unitPrice} = ${currency} ${expected}. Review the source invoice.`,
        "amount", `${currency} ${total}`);
    }
  }
  const requester = String(record.requested_by || "").trim();
  const approver = String(record.approved_by || "").trim();
  if (requester && approver && requester.toLowerCase() === approver.toLowerCase()) {
    emit("PROC-APPROVAL", "high", "Requester self-approved",
      `Requested By and Approved By both state "${requester}"; review approval authority.`, "approved_by", approver);
  }
  const invoice = String(record.invoice_no || "").trim();
  if (invoice && batchRows.some((r) => r !== record && r.vendor?.trim().toLowerCase() === record.vendor?.trim().toLowerCase() && String(r.invoice_no || "").trim().toLowerCase() === invoice.toLowerCase())) {
    emit("PROC-DUPLICATE", "high", "Repeated vendor invoice number",
      `Invoice ${invoice} appears more than once for ${record.vendor} in this batch; review for duplicate payment.`, "invoice_no", invoice);
  }
  const peers = batchRows.filter((r) => r !== record && r.item_description?.trim().toLowerCase() === record.item_description?.trim().toLowerCase()
    && r.unit?.trim().toLowerCase() === record.unit?.trim().toLowerCase() && r.currency === record.currency
    && Number(r.unit_price) > 0).map((r) => ({ price: Number(r.unit_price), id: r.transaction_id }));
  if (record.item_description && unitPrice > 0 && peers.length >= 3) {
    const sorted = peers.map((p) => p.price).sort((a, b) => a - b);
    const median = sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
    if (unitPrice > median * 1.5) {
      emit("PROC-PEER", "high", "Quoted price above batch peers",
        `${record.item_description}: quoted ${currency} ${unitPrice} per ${record.unit || "unit"} versus median ${currency} ${median} across ${peers.length} same-item, same-unit batch rows (${peers.map((p) => p.id).join(", ")}). This is an internal comparison, not an external market price.`,
        "unit_price", `${currency} ${unitPrice}`);
    }
  }
  return findings;
}