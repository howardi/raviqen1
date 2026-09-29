// HR Export & Reporting Engine
// Generates Excel-compatible CSV downloads and PDF reports

import jsPDF from "jspdf";

// === CSV / Excel Export ===

function downloadCSV(filename, headers, rows) {
  const csv = [
    headers.join(","),
    ...rows.map((r) => r.map((cell) => {
      const s = String(cell ?? "");
      if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
      return s;
    }).join(",")),
  ].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportEmployeeDirectoryCSV(employees, filters = {}) {
  const headers = ["Employee ID", "Full Name", "Department", "Role", "Date of Joining", "Status", "National ID", "Phone", "Risk Score", "Risk Flags"];
  const rows = employees.map((e) => [
    e.employee_id, e.full_name, e.department, e.role_title, e.date_of_joining,
    e.employment_status, e.national_id_ssn || "", e.contact_phone || "",
    e.risk_score || 0, (e.risk_flags || []).join("; "),
  ]);
  const suffix = filters.department ? `_${filters.department}` : "";
  downloadCSV(`RAVIQEN_Employee_Directory${suffix}_${new Date().toISOString().split("T")[0]}.csv`, headers, rows);
}

export function exportAttendanceSheetCSV(records, filters = {}) {
  const headers = ["Employee ID", "Employee Name", "Department", "Date", "Clock In", "Clock Out", "Status", "Hours Worked", "Anomalies"];
  const rows = records.map((r) => [
    r.employee_id, r.employee_name || "", r.department, r.date,
    r.clock_in_time || "", r.clock_out_time || "", r.status,
    r.hours_worked || 0, (r.anomaly_flags || []).join("; "),
  ]);
  const suffix = filters.month ? `_${filters.month}` : "";
  downloadCSV(`RAVIQEN_Attendance_Sheet${suffix}_${new Date().toISOString().split("T")[0]}.csv`, headers, rows);
}

export function exportBackgroundCheckAuditCSV(checks) {
  const headers = ["Candidate Name", "National ID", "Position", "Department", "Overall Status", "Risk Score", "Risk Level", "Flags", "Screening Date", "Screened By"];
  const rows = checks.map((c) => [
    c.candidate_name, c.national_id, c.position_applied || "", c.department || "",
    c.overall_status, c.risk_score, c.risk_level,
    (c.flags || []).join("; "),
    c.screening_date ? new Date(c.screening_date).toLocaleDateString() : "",
    c.screened_by || "",
  ]);
  downloadCSV(`RAVIQEN_Background_Check_Audit_${new Date().toISOString().split("T")[0]}.csv`, headers, rows);
}

// === PDF Reports ===

function addBrandingHeader(doc, profile) {
  const companyName = profile?.company_name || "RAVIQEN";
  const contactEmail = profile?.contact_email || "";
  const contactPhone = profile?.contact_phone || "";
  const footerText = profile?.footer_text || "RAVIQEN — AI Risk & Compliance Intelligence";

  // Header bar
  doc.setFillColor(35, 31, 32);
  doc.rect(0, 0, 210, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(companyName, 14, 14);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Workforce Intelligence & Risk Suite", 14, 19);
  doc.text(new Date().toLocaleString(), 160, 14, { align: "right" });

  return { companyName, contactEmail, contactPhone, footerText };
}

function addFooter(doc, footerText, page, totalPages) {
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text(footerText, 105, 290, { align: "center" });
  doc.text(`Page ${page} of ${totalPages}`, 196, 290, { align: "right" });
}

export function exportBackgroundCheckPDF(check, profile) {
  const doc = new jsPDF();
  const branding = addBrandingHeader(doc, profile);

  let y = 32;
  doc.setTextColor(35, 31, 32);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Background Screening Report", 14, y);
  y += 8;

  // Candidate info box
  doc.setDrawColor(220, 220, 220);
  doc.setFillColor(248, 249, 250);
  doc.roundedRect(14, y, 182, 36, 2, 2, "FD");
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Candidate Details", 18, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const infoLines = [
    `Name: ${check.candidate_name}`,
    `National ID: ${check.national_id}`,
    `Tax Number: ${check.tax_number || "N/A"}`,
    `Position Applied: ${check.position_applied || "N/A"}`,
    `Department: ${check.department || "N/A"}`,
    `Date of Birth: ${check.date_of_birth || "N/A"}`,
    `Previous Employer: ${check.previous_employer || "N/A"}`,
    `Screening Date: ${check.screening_date ? new Date(check.screening_date).toLocaleString() : "N/A"}`,
    `Screened By: ${check.screened_by || "System"}`,
  ];
  infoLines.forEach((line, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    doc.text(line, 18 + col * 90, y + 12 + row * 5);
  });
  y += 42;

  // Overall verdict
  const verdictColors = {
    cleared: [16, 185, 129], flagged: [245, 158, 11], rejected: [239, 68, 68], pending: [100, 116, 139],
  };
  const color = verdictColors[check.overall_status] || verdictColors.pending;
  doc.setFillColor(...color);
  doc.roundedRect(14, y, 182, 14, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(`Overall Status: ${check.overall_status?.toUpperCase() || "PENDING"}`, 18, y + 9);
  doc.text(`Risk Score: ${check.risk_score || 0}/100 (${check.risk_level || "low"})`, 150, y + 9, { align: "right" });
  y += 20;

  // Screening results table
  doc.setTextColor(35, 31, 32);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Screening Results", 14, y);
  y += 4;

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setFillColor(240, 240, 240);
  doc.rect(14, y, 182, 6, "F");
  doc.text("Check", 18, y + 4);
  doc.text("Status", 120, y + 4);
  doc.text("Details", 150, y + 4);
  y += 8;

  doc.setFont("helvetica", "normal");
  (check.screening_results || []).forEach((r) => {
    if (y > 270) { doc.addPage(); y = 20; }
    doc.text(r.check_name || "", 18, y);
    doc.text(r.status || "", 120, y);
    const details = (r.details || "").substring(0, 50);
    doc.text(details, 150, y);
    y += 5;
  });
  y += 4;

  // Flags
  if (check.flags?.length > 0) {
    if (y > 260) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Risk Flags", 14, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    check.flags.forEach((f) => {
      doc.text(`• ${f}`, 18, y);
      y += 5;
    });
    y += 3;
  }

  // AI Assessment
  if (check.ai_assessment) {
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFillColor(35, 31, 32);
    doc.roundedRect(14, y, 182, 5, 1, 1, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("AI Risk Assessment", 18, y + 3.5);
    y += 8;
    doc.setTextColor(60, 60, 60);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(check.ai_assessment, 175);
    lines.forEach((line) => {
      if (y > 280) { doc.addPage(); y = 20; }
      doc.text(line, 18, y);
      y += 4;
    });
    y += 4;
  }

  // Recommendations
  if (check.recommendations?.length > 0) {
    if (y > 260) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(35, 31, 32);
    doc.text("Hiring Recommendations", 14, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    check.recommendations.forEach((r) => {
      if (y > 280) { doc.addPage(); y = 20; }
      doc.text(`• ${r}`, 18, y);
      y += 5;
    });
  }

  addFooter(doc, branding.footerText, 1, doc.getNumberOfPages());
  doc.save(`RAVIQEN_Screening_${check.candidate_name?.replace(/\s/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`);
}

export function exportAttendanceSummaryPDF(records, department, profile) {
  const doc = new jsPDF();
  const branding = addBrandingHeader(doc, profile);

  let y = 32;
  doc.setTextColor(35, 31, 32);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Departmental Attendance Summary", 14, y);
  y += 6;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Department: ${department || "All Departments"}`, 14, y);
  y += 5;
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, y);
  y += 8;

  // Summary stats
  const stats = {
    total: records.length,
    present: records.filter((r) => r.status === "present").length,
    late: records.filter((r) => r.status === "late").length,
    absent: records.filter((r) => r.status === "absent").length,
    sick: records.filter((r) => r.status === "sick_leave").length,
    overtime: records.filter((r) => r.status === "overtime").length,
    flagged: records.filter((r) => r.anomaly_flags?.length > 0).length,
  };

  doc.setFillColor(248, 249, 250);
  doc.roundedRect(14, y, 182, 18, 2, 2, "FD");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("Summary", 18, y + 5);
  doc.setFont("helvetica", "normal");
  const statLines = [
    `Total Records: ${stats.total}`,
    `Present: ${stats.present}`,
    `Late: ${stats.late}`,
    `Absent: ${stats.absent}`,
    `Sick Leave: ${stats.sick}`,
    `Overtime: ${stats.overtime}`,
    `Anomalies Flagged: ${stats.flagged}`,
  ];
  statLines.forEach((line, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    doc.text(line, 18 + col * 45, y + 10 + row * 4);
  });
  y += 24;

  // Records table
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setFillColor(240, 240, 240);
  doc.rect(14, y, 182, 6, "F");
  doc.text("Emp ID", 18, y + 4);
  doc.text("Name", 45, y + 4);
  doc.text("Date", 95, y + 4);
  doc.text("In", 115, y + 4);
  doc.text("Out", 130, y + 4);
  doc.text("Status", 145, y + 4);
  doc.text("Hours", 170, y + 4);
  doc.text("Anomalies", 182, y + 4);
  y += 8;

  doc.setFont("helvetica", "normal");
  records.slice(0, 40).forEach((r) => {
    if (y > 280) { doc.addPage(); y = 20; }
    doc.text(String(r.employee_id || "").substring(0, 10), 18, y);
    doc.text(String(r.employee_name || "").substring(0, 20), 45, y);
    doc.text(r.date || "", 95, y);
    doc.text(r.clock_in_time || "", 115, y);
    doc.text(r.clock_out_time || "", 130, y);
    doc.text(r.status || "", 145, y);
    doc.text(String(r.hours_worked || 0), 170, y);
    doc.text((r.anomaly_flags || []).length > 0 ? "⚠" : "", 182, y);
    y += 5;
  });

  if (records.length > 40) {
    y += 4;
    doc.setFont("helvetica", "italic");
    doc.text(`... and ${records.length - 40} more records (see CSV export for full data)`, 14, y);
  }

  addFooter(doc, branding.footerText, 1, doc.getNumberOfPages());
  doc.save(`RAVIQEN_Attendance_Summary_${department || "all"}_${new Date().toISOString().split("T")[0]}.pdf`);
}