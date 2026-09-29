import { jsPDF } from "jspdf";
import { renderMarkdownToPDF, cleanMarkdownToPlainText } from "./markdownCleaner";

async function fetchImageAsBase64(url) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function hexToRgb(hex) {
  if (!hex || !hex.startsWith("#")) return [23, 31, 32];
  return [
    parseInt(hex.slice(1, 3), 16) || 23,
    parseInt(hex.slice(3, 5), 16) || 31,
    parseInt(hex.slice(5, 7), 16) || 32,
  ];
}

function getImageFormat(url) {
  const lower = (url || "").toLowerCase();
  if (lower.match(/\.(png)(\?|$)/)) return "PNG";
  if (lower.match(/\.(jpe?g)(\?|$)/)) return "JPEG";
  return "PNG";
}

// Build a branded PDF report from markdown content + company profile
export async function buildPDFReport({ title, content, profile, subtitle }) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const maxWidth = pageWidth - margin * 2;

  const companyName = profile?.company_name || "RAVIQEN";
  const footerText = profile?.footer_text || "RAVIQEN Confidential";
  const brandColor = hexToRgb(profile?.brand_color);

  // --- Header bar ---
  doc.setFillColor(brandColor[0], brandColor[1], brandColor[2]);
  doc.rect(0, 0, pageWidth, 60, "F");

  let textX = margin;
  if (profile?.logo_url) {
    const logoBase64 = await fetchImageAsBase64(profile.logo_url);
    if (logoBase64) {
      try {
        doc.addImage(logoBase64, getImageFormat(profile.logo_url), margin, 12, 36, 36, undefined, "FAST");
        textX = margin + 44;
      } catch (e) { /* skip logo */ }
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(companyName, textX, 25);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(subtitle || "Risk & Compliance Report", textX, 40);

  doc.setFontSize(8);
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - margin, 25, { align: "right" });

  let y = 80;

  // Company info under header
  if (profile?.company_name) {
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    const infoParts = [];
    if (profile.address) infoParts.push(profile.address);
    if (profile.registration_number) infoParts.push(`Reg: ${profile.registration_number}`);
    if (infoParts.length) {
      doc.text(infoParts.join("  |  "), margin, y);
      y += 12;
    }
  }

  // Title
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(35, 31, 32);
  doc.text(title, margin, y);
  y += 20;

  // Divider
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 15;

  // Content (markdown rendered cleanly — no raw symbols)
  y = renderMarkdownToPDF(doc, content, margin, y, maxWidth, {
    fontSize: 10, lineHeight: 14, pageHeight, margin,
  });

  // --- Footer on each page ---
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, pageHeight - 25, pageWidth - margin, pageHeight - 25);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(footerText, margin, pageHeight - 15);
    const contactParts = [];
    if (profile?.contact_email) contactParts.push(profile.contact_email);
    if (profile?.contact_phone) contactParts.push(profile.contact_phone);
    if (contactParts.length) {
      doc.text(contactParts.join("  |  "), pageWidth / 2, pageHeight - 15, { align: "center" });
    }
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 15, { align: "right" });
  }

  return doc;
}

// Build a branded CSV/Excel report with company header rows
export function buildCSVReport({ title, content, profile }) {
  const companyName = profile?.company_name || "RAVIQEN";
  const rows = [];
  rows.push(["Company", companyName]);
  if (profile?.address) rows.push(["Address", profile.address]);
  if (profile?.registration_number) rows.push(["Registration Number", profile.registration_number]);
  if (profile?.contact_email) rows.push(["Contact Email", profile.contact_email]);
  if (profile?.contact_phone) rows.push(["Contact Phone", profile.contact_phone]);
  rows.push(["Footer Notice", profile?.footer_text || "RAVIQEN Confidential"]);
  rows.push(["Generated", new Date().toLocaleString()]);
  rows.push([]);
  rows.push(["Report", title]);
  rows.push([]);
  const cleanContent = cleanMarkdownToPlainText(content);
  cleanContent.split("\n").forEach((l) => rows.push([l]));

  return rows.map((r) => r.map((c) => `"${String(c || "").replace(/"/g, '""')}"`).join(",")).join("\n");
}

export function downloadCSV(csv, filename, isExcel = false) {
  const blob = new Blob([csv], { type: isExcel ? "application/vnd.ms-excel" : "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}