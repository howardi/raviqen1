import { base44 } from "@/api/base44Client";

// Fixed, standardized report sections — ensures every investigation follows the same format
export const REPORT_SECTIONS = [
  { id: "executive_summary", label: "Executive Summary", order: 1 },
  { id: "transaction_details", label: "Transaction Details", order: 2 },
  { id: "evidence_signals", label: "Evidence & Anomaly Signals", order: 3 },
  { id: "ai_risk_assessment", label: "AI Risk Assessment", order: 4 },
  { id: "cross_reference", label: "Source Data Cross-Reference", order: 5 },
  { id: "compliance_impact", label: "Compliance Impact Analysis", order: 6 },
  { id: "financial_impact", label: "Financial Impact Estimation", order: 7 },
  { id: "recommended_actions", label: "Recommended Actions", order: 8 },
  { id: "similar_cases", label: "Similar Cases Detected", order: 9 },
  { id: "qa_history", label: "Investigator Q&A Log", order: 10 },
  { id: "investigator_notes", label: "Investigator Notes", order: 11 },
  { id: "conclusion", label: "Conclusion & Outcome", order: 12 },
  { id: "audit_trail", label: "Audit Trail & Sign-off", order: 13 },
];

// Build the structured report data object from all wizard state — auto-fills from collected data
export function buildReportData({
  investigation, alert, transaction, evidenceItems,
  aiSummary, aiConfidence, citedSignals,
  sourceRecords, complianceAnalysis, financialImpact,
  recommendations, similarCases, qaHistory,
  outcome, notes,
}) {
  return {
    meta: {
      report_id: `RPT-${(investigation?.transaction_id || investigation?.id || "XXXX").replace(/\s/g, "")}`,
      title: investigation?.title || "Untitled Investigation",
      transaction_id: investigation?.transaction_id || "—",
      vendor: investigation?.vendor || "—",
      risk_level: investigation?.risk_level || "—",
      created_date: investigation?.created_date,
      investigator: investigation?.investigator || "Unassigned",
      outcome: outcome || "pending",
      generated_at: new Date().toISOString(),
    },
    transaction: {
      amount: transaction?.amount ?? alert?.amount ?? 0,
      currency: transaction?.currency || "USD",
      date: transaction?.transaction_date || "—",
      payment_method: transaction?.payment_method || "—",
      location: transaction?.location || "—",
      category: transaction?.category || "—",
      vendor: transaction?.vendor || investigation?.vendor || "—",
    },
    alert: {
      description: alert?.description || "—",
      flag_reasons: alert?.flag_reasons || [],
      risk_score: alert?.risk_score ?? 0,
    },
    evidence: evidenceItems || [],
    aiAssessment: {
      summary: aiSummary || "",
      confidence: aiConfidence || "medium",
      cited_signals: citedSignals || [],
    },
    crossReference: sourceRecords || [],
    compliance: complianceAnalysis || null,
    financialImpact: financialImpact || null,
    recommendations: recommendations || [],
    similarCases: similarCases || [],
    qaHistory: qaHistory || [],
    notes: notes || "",
    outcome: outcome || "pending",
  };
}

// Generate the narrative sections (executive summary + conclusion) via LLM — the only free-form text
export async function generateReportNarrative(reportData) {
  const r = reportData;
  const evidenceStr = (r.evidence || []).map((e) => `- ${e.label}: ${e.value} (${e.severity})`).join("\n");
  const crossRefStr = (r.crossReference || []).map((x) => `- [${x.source_type}] ${x.record_type}: ${x.vendor}, $${x.amount} (${x.match_status})`).join("\n");
  const recsStr = (r.recommendations || []).map((rec, i) => `${i + 1}. ${rec.action || rec} [${rec.priority || "medium"}]`).join("\n");

  const res = await base44.integrations.Core.InvokeLLM({
    prompt: `You are RAVIQEN, an AI risk and compliance analyst. Generate the narrative sections of a standardized investigation report.

CASE: ${r.meta.title}
Transaction ID: ${r.meta.transaction_id}
Vendor: ${r.meta.vendor}
Risk Level: ${r.meta.risk_level}
Outcome: ${r.outcome}
Alert: ${r.alert.description}
Flag reasons: ${r.alert.flag_reasons.join(", ")}

Evidence signals:
${evidenceStr}

Cross-referenced records:
${crossRefStr}

Recommended actions:
${recsStr}

Investigator notes: ${r.notes || "None"}

Produce TWO sections in audit-ready, professional language:
1. executive_summary: A 4-5 sentence overview of the case, the key risk factors, and the investigation outcome. Cite evidence signals by name.
2. conclusion: A 3-4 sentence formal conclusion stating the determined outcome, the supporting rationale, and any residual risk or recommended follow-up.`,
    response_json_schema: {
      type: "object",
      properties: {
        executive_summary: { type: "string" },
        conclusion: { type: "string" },
      },
    },
  });
  return typeof res === "string" ? { executive_summary: res, conclusion: "" } : res;
}

// Export the standardized report as a consistent Markdown document
export function exportReportAsMarkdown(reportData, narrative) {
  const n = narrative || {};
  const r = reportData;
  const lines = [];
  const div = () => lines.push("");
  const fmtMoney = (amt, cur = "USD") => `${cur === "USD" ? "$" : ""}${Number(amt || 0).toLocaleString()}`;

  lines.push(`# RAVIQEN Investigation Report`);
  lines.push(`**Report ID:** ${r.meta.report_id}`);
  lines.push(`**Generated:** ${new Date(r.meta.generated_at || Date.now()).toLocaleString()}`);
  lines.push(`**Classification:** ${r.meta.risk_level?.toUpperCase()} Risk`);
  lines.push(`**Status:** ${r.outcome?.toUpperCase()}`);
  div();
  lines.push(`---`);
  div();

  lines.push(`## 1. Executive Summary`);
  lines.push(n.executive_summary || "_Pending generation_");
  div();

  lines.push(`## 2. Transaction Details`);
  lines.push(`| Field | Value |`);
  lines.push(`|---|---|`);
  lines.push(`| Transaction ID | ${r.meta.transaction_id} |`);
  lines.push(`| Vendor | ${r.transaction.vendor} |`);
  lines.push(`| Amount | ${fmtMoney(r.transaction.amount, r.transaction.currency)} |`);
  lines.push(`| Date | ${r.transaction.date} |`);
  lines.push(`| Payment Method | ${r.transaction.payment_method} |`);
  lines.push(`| Location | ${r.transaction.location} |`);
  lines.push(`| Category | ${r.transaction.category} |`);
  div();

  lines.push(`## 3. Evidence & Anomaly Signals`);
  if (r.evidence.length) {
    r.evidence.forEach((e, i) => lines.push(`${i + 1}. **${e.label}** — ${e.value} _(severity: ${e.severity})_`));
  } else {
    lines.push(`_No evidence signals recorded._`);
  }
  div();

  lines.push(`## 4. AI Risk Assessment`);
  lines.push(`**Confidence:** ${r.aiAssessment.confidence}`);
  lines.push(`**Summary:** ${r.aiAssessment.summary || "_Not generated_"}`);
  if (r.aiAssessment.cited_signals.length) {
    lines.push(`**Cited Signals:** ${r.aiAssessment.cited_signals.join(", ")}`);
  }
  div();

  lines.push(`## 5. Source Data Cross-Reference`);
  if (r.crossReference.length) {
    lines.push(`| Source | Type | Vendor | Amount | Date | Status |`);
    lines.push(`|---|---|---|---|---|---|`);
    r.crossReference.forEach((x) => lines.push(`| ${x.source_type} | ${x.record_type} | ${x.vendor} | ${fmtMoney(x.amount)} | ${x.record_date} | ${x.match_status} |`));
  } else {
    lines.push(`_No cross-reference records._`);
  }
  div();

  lines.push(`## 6. Compliance Impact Analysis`);
  if (r.compliance?.frameworks?.length) {
    r.compliance.frameworks.forEach((f) => lines.push(`- **${f.framework}** (${f.relevance}): ${f.potential_violation}`));
    if (r.compliance.overall_assessment) lines.push(`\n${r.compliance.overall_assessment}`);
  } else {
    lines.push(`_Not analyzed._`);
  }
  div();

  lines.push(`## 7. Financial Impact Estimation`);
  if (r.financialImpact) {
    lines.push(`**Estimated Exposure:** ${fmtMoney(r.financialImpact.estimated_exposure)}`);
    lines.push(`**Range:** ${fmtMoney(r.financialImpact.exposure_range_low)} – ${fmtMoney(r.financialImpact.exposure_range_high)}`);
    lines.push(`**Category:** ${r.financialImpact.impact_category}`);
    if (r.financialImpact.factors?.length) lines.push(`**Factors:** ${r.financialImpact.factors.join("; ")}`);
    if (r.financialImpact.mitigation_value) lines.push(`**Mitigation:** ${r.financialImpact.mitigation_value}`);
  } else {
    lines.push(`_Not estimated._`);
  }
  div();

  lines.push(`## 8. Recommended Actions`);
  if (r.recommendations.length) {
    r.recommendations.forEach((rec, i) => lines.push(`${i + 1}. [${rec.priority?.toUpperCase()}] ${rec.action} — ${rec.rationale}`));
  } else {
    lines.push(`_None generated._`);
  }
  div();

  lines.push(`## 9. Similar Cases Detected`);
  if (r.similarCases.length) {
    r.similarCases.forEach((c) => lines.push(`- ${c.title} (${c.similarity_score}%): ${c.reason}`));
  } else {
    lines.push(`_None detected._`);
  }
  div();

  lines.push(`## 10. Investigator Q&A Log`);
  if (r.qaHistory.length) {
    r.qaHistory.forEach((qa, i) => { lines.push(`**Q${i + 1}:** ${qa.question}`); lines.push(`**A:** ${qa.answer}`); div(); });
  } else {
    lines.push(`_No questions asked._`);
  }
  div();

  lines.push(`## 11. Investigator Notes`);
  lines.push(r.notes || "_None recorded._");
  div();

  lines.push(`## 12. Conclusion & Outcome`);
  lines.push(n.conclusion || "_Pending generation_");
  div();

  lines.push(`## 13. Audit Trail & Sign-off`);
  lines.push(`- **Investigator:** ${r.meta.investigator}`);
  lines.push(`- **Created:** ${r.meta.created_date ? new Date(r.meta.created_date).toLocaleString() : "—"}`);
  lines.push(`- **Outcome:** ${r.outcome}`);
  lines.push(`- **Report generated by:** RAVIQEN AI Risk & Compliance Intelligence`);

  return lines.join("\n");
}