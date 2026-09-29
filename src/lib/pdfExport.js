import { jsPDF } from "jspdf";

async function _fetchImageAsBase64(url) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

function _hexToRgb(hex) {
  if (!hex || !hex.startsWith("#")) return [23, 31, 32];
  return [parseInt(hex.slice(1, 3), 16) || 23, parseInt(hex.slice(3, 5), 16) || 31, parseInt(hex.slice(5, 7), 16) || 32];
}

export async function exportReportAsPDF(reportData, narrative, profile) {
  const n = narrative || {};
  const r = reportData;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const maxWidth = pageWidth - margin * 2;
  let y = margin;

  const ensureSpace = (needed) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const addText = (text, size, style = "normal", color = [35, 31, 32]) => {
    if (!text) return;
    doc.setFontSize(size);
    doc.setFont("helvetica", style);
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(String(text), maxWidth);
    lines.forEach((line) => {
      ensureSpace(size + 4);
      doc.text(line, margin, y);
      y += size + 4;
    });
  };

  const addSectionHeader = (num, label) => {
    y += 8;
    ensureSpace(30);
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, y - 4, maxWidth, 20, "F");
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(35, 31, 32);
    doc.text(`${num}. ${label}`, margin + 8, y + 9);
    y += 24;
  };

  const fmtMoney = (amt, cur = "USD") => `${cur === "USD" ? "$" : ""}${Number(amt || 0).toLocaleString()}`;

  // Header bar with company branding
  const _brandColor = _hexToRgb(profile?.brand_color);
  const _companyName = profile?.company_name || "RAVIQEN";
  doc.setFillColor(_brandColor[0], _brandColor[1], _brandColor[2]);
  doc.rect(0, 0, pageWidth, 60, "F");
  let _headerTextX = margin;
  if (profile?.logo_url) {
    const _logo = await _fetchImageAsBase64(profile.logo_url);
    if (_logo) {
      try {
        const _fmt = profile.logo_url.match(/\.(png)/i) ? "PNG" : profile.logo_url.match(/\.(jpe?g)/i) ? "JPEG" : "PNG";
        doc.addImage(_logo, _fmt, margin, 8, 44, 44, undefined, "FAST");
        _headerTextX = margin + 52;
      } catch (e) { /* skip logo */ }
    }
  }
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(_companyName, _headerTextX, 25);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Investigation Report", _headerTextX, 42);
  doc.setFontSize(9);
  doc.text(`Report ID: ${r.meta.report_id}`, pageWidth - margin, 25, { align: "right" });
  doc.text(new Date(r.meta.generated_at || Date.now()).toLocaleString(), pageWidth - margin, 42, { align: "right" });
  y = 80;

  // Title + meta
  addText(r.meta.title, 13, "bold");
  addText(`Risk Level: ${(r.meta.risk_level || "—").toUpperCase()}  |  Status: ${(r.outcome || "—").toUpperCase()}  |  Investigator: ${r.meta.investigator}`, 9, "normal", [100, 100, 100]);
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  addSectionHeader(1, "Executive Summary");
  addText(n.executive_summary || "Pending generation.", 10, "normal");

  addSectionHeader(2, "Transaction Details");
  [
    ["Transaction ID", r.meta.transaction_id],
    ["Vendor", r.transaction.vendor],
    ["Amount", fmtMoney(r.transaction.amount, r.transaction.currency)],
    ["Date", r.transaction.date],
    ["Payment Method", r.transaction.payment_method],
    ["Location", r.transaction.location],
    ["Category", r.transaction.category],
  ].forEach(([label, value]) => addText(`${label}: ${value}`, 10, "normal"));

  addSectionHeader(3, "Evidence & Anomaly Signals");
  if (r.evidence.length) {
    r.evidence.forEach((e, i) => addText(`${i + 1}. ${e.label} — ${e.value} (severity: ${e.severity})`, 10, "normal"));
  } else {
    addText("No evidence signals recorded.", 10, "italic", [150, 150, 150]);
  }

  addSectionHeader(4, "AI Risk Assessment");
  addText(`Confidence: ${r.aiAssessment.confidence}`, 10, "bold");
  addText(`Summary: ${r.aiAssessment.summary || "Not generated"}`, 10, "normal");
  if (r.aiAssessment.cited_signals?.length) {
    addText(`Cited Signals: ${r.aiAssessment.cited_signals.join(", ")}`, 10, "normal");
  }

  addSectionHeader(5, "Source Data Cross-Reference");
  if (r.crossReference.length) {
    r.crossReference.forEach((x) => addText(`[${x.source_type}] ${x.record_type}: ${x.vendor}, ${fmtMoney(x.amount)} (${x.match_status})`, 10, "normal"));
  } else {
    addText("No cross-reference records.", 10, "italic", [150, 150, 150]);
  }

  addSectionHeader(6, "Compliance Impact Analysis");
  if (r.compliance?.frameworks?.length) {
    r.compliance.frameworks.forEach((f) => addText(`- ${f.framework} (${f.relevance}): ${f.potential_violation}`, 10, "normal"));
    if (r.compliance.overall_assessment) addText(r.compliance.overall_assessment, 10, "normal");
  } else {
    addText("Not analyzed.", 10, "italic", [150, 150, 150]);
  }

  addSectionHeader(7, "Financial Impact Estimation");
  if (r.financialImpact) {
    addText(`Estimated Exposure: ${fmtMoney(r.financialImpact.estimated_exposure)}`, 10, "normal");
    addText(`Range: ${fmtMoney(r.financialImpact.exposure_range_low)} – ${fmtMoney(r.financialImpact.exposure_range_high)}`, 10, "normal");
    addText(`Category: ${r.financialImpact.impact_category}`, 10, "normal");
    if (r.financialImpact.factors?.length) addText(`Factors: ${r.financialImpact.factors.join("; ")}`, 10, "normal");
    if (r.financialImpact.mitigation_value) addText(`Mitigation: ${r.financialImpact.mitigation_value}`, 10, "normal");
  } else {
    addText("Not estimated.", 10, "italic", [150, 150, 150]);
  }

  addSectionHeader(8, "Recommended Actions");
  if (r.recommendations.length) {
    r.recommendations.forEach((rec, i) => addText(`${i + 1}. [${(rec.priority || "medium").toUpperCase()}] ${rec.action} — ${rec.rationale}`, 10, "normal"));
  } else {
    addText("None generated.", 10, "italic", [150, 150, 150]);
  }

  addSectionHeader(9, "Similar Cases Detected");
  if (r.similarCases.length) {
    r.similarCases.forEach((c) => addText(`- ${c.title} (${c.similarity_score}%): ${c.reason}`, 10, "normal"));
  } else {
    addText("None detected.", 10, "italic", [150, 150, 150]);
  }

  addSectionHeader(10, "Investigator Q&A Log");
  if (r.qaHistory.length) {
    r.qaHistory.forEach((qa, i) => {
      addText(`Q${i + 1}: ${qa.question}`, 10, "bold");
      addText(`A: ${qa.answer}`, 10, "normal");
    });
  } else {
    addText("No questions asked.", 10, "italic", [150, 150, 150]);
  }

  addSectionHeader(11, "Investigator Notes");
  addText(r.notes || "None recorded.", 10, "normal");

  addSectionHeader(12, "Conclusion & Outcome");
  addText(n.conclusion || "Pending generation.", 10, "normal");

  addSectionHeader(13, "Audit Trail & Sign-off");
  addText(`Investigator: ${r.meta.investigator}`, 10, "normal");
  addText(`Created: ${r.meta.created_date ? new Date(r.meta.created_date).toLocaleString() : "—"}`, 10, "normal");
  addText(`Outcome: ${r.outcome}`, 10, "normal");
  addText(`Report generated by: ${profile?.company_name || "RAVIQEN AI Risk & Compliance Intelligence"}`, 10, "normal");

  // Footer on each page with company branding
  const pageCount = doc.internal.getNumberOfPages();
  const _footerText = profile?.footer_text || "RAVIQEN Confidential";
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`${_footerText} — ${r.meta.report_id}`, margin, pageHeight - 15);
    const _contactParts = [];
    if (profile?.contact_email) _contactParts.push(profile.contact_email);
    if (profile?.contact_phone) _contactParts.push(profile.contact_phone);
    if (_contactParts.length) {
      doc.text(_contactParts.join("  |  "), pageWidth / 2, pageHeight - 15, { align: "center" });
    }
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 15, { align: "right" });
  }

  doc.save(`RAVIQEN_${r.meta.report_id}.pdf`);
}