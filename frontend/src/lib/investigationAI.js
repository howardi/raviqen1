import { base44 } from "@/api/base44Client";
import { claimsAreGrounded, groundFinancialImpact, groundSimilarCases } from "@/lib/llmGrounding";

// Step 2: AI Grounded Risk Summary
export async function generateRiskSummary(investigation, alert, evidenceItems) {
  const res = await base44.integrations.Core.InvokeLLM({
    prompt: `You are RAVIQEN, an AI risk and compliance analyst. Produce a grounded risk summary for this flagged transaction.

Transaction: ${investigation?.title}
Vendor: ${investigation?.vendor}
Transaction ID: ${investigation?.transaction_id}
Risk Level: ${investigation?.risk_level}
Alert context: ${alert?.description || "N/A"}
Flag reasons: ${(alert?.flag_reasons || []).join(", ")}
Evidence signals:
${(evidenceItems || []).map((e, i) => `${i + 1}. ${e.label}: ${e.value} (severity: ${e.severity})`).join("\n")}

Write a concise 4-5 sentence risk summary explaining WHY this transaction was flagged. Cite the specific evidence signals by name. State your confidence level. Do not speculate beyond the provided data. Use a calm, professional tone.`,
    response_json_schema: {
      type: "object",
      properties: {
        summary: { type: "string" },
        confidence: { type: "string", enum: ["low", "medium", "high"] },
        cited_signals: { type: "array", items: { type: "string" } },
      },
    },
  });
  const parsed = typeof res === "string" ? { summary: res, confidence: "low", cited_signals: [] } : (res || {});
  const labels = new Set((evidenceItems || []).map((item) => item.label));
  const cited = (parsed.cited_signals || []).filter((signal) => labels.has(signal));
  const source = JSON.stringify({ investigation, alert, evidenceItems });
  if (!claimsAreGrounded(parsed.summary, source) || cited.length !== (parsed.cited_signals || []).length) {
    return {
      summary: "Review the recorded evidence signals only. The model added a figure or signal that is not in this investigation.",
      confidence: "low",
      cited_signals: cited,
    };
  }
  return { summary: parsed.summary, confidence: parsed.confidence || "low", cited_signals: cited };
}

// Step 4: AI Recommended Actions
export async function generateRecommendations(investigation, alert, evidenceItems, crossRefSummary) {
  const res = await base44.integrations.Core.InvokeLLM({
    prompt: `You are RAVIQEN, an AI risk and compliance analyst. Recommend the next actions an investigator should take for this flagged transaction.

Transaction: ${investigation?.title}
Vendor: ${investigation?.vendor}
Risk Level: ${investigation?.risk_level}
Evidence signals: ${(evidenceItems || []).map((e) => e.label).join(", ")}
Cross-reference findings: ${crossRefSummary || "Not yet performed"}

Provide 4-5 specific, actionable next steps an investigator should take. Each should be a concrete action (e.g. "Contact vendor to verify invoice", "Request supporting documentation", "Temporarily hold payment"). Prioritize by urgency.`,
    response_json_schema: {
      type: "object",
      properties: {
        recommendations: {
          type: "array",
          items: {
            type: "object",
            properties: {
              action: { type: "string" },
              priority: { type: "string", enum: ["immediate", "high", "medium", "low"] },
              rationale: { type: "string" },
            },
          },
        },
      },
    },
  });
  return typeof res === "string" ? { recommendations: [] } : res;
}

// Step 4: Similar Case Detection
export async function detectSimilarCases(investigation, alert, allInvestigations) {
  const others = (allInvestigations || [])
    .filter((i) => i.id !== investigation?.id)
    .slice(0, 20)
    .map((i) => ({ id: i.id, title: i.title, vendor: i.vendor, risk_level: i.risk_level, outcome: i.outcome, transaction_id: i.transaction_id }));

  const res = await base44.integrations.Core.InvokeLLM({
    prompt: `You are RAVIQEN, an AI risk and compliance analyst. Detect historically similar cases to the current flagged transaction.

Current transaction:
- Title: ${investigation?.title}
- Vendor: ${investigation?.vendor}
- Risk Level: ${investigation?.risk_level}
- Flag reasons: ${(alert?.flag_reasons || []).join(", ")}

Historical investigations to compare against:
${JSON.stringify(others, null, 2)}

Identify up to 3 cases that are most similar (same vendor, similar flag reasons, similar risk pattern, or similar outcome). For each, provide a similarity score (0-100) and a brief reason for the match. If none are similar, return an empty array.`,
    response_json_schema: {
      type: "object",
      properties: {
        similar_cases: {
          type: "array",
          items: {
            type: "object",
            properties: {
              investigation_id: { type: "string" },
              title: { type: "string" },
              vendor: { type: "string" },
              similarity_score: { type: "number" },
              reason: { type: "string" },
            },
          },
        },
      },
    },
  });
  const parsed = typeof res === "string" ? { similar_cases: [] } : (res || {});
  return { similar_cases: groundSimilarCases(parsed.similar_cases, others.map((item) => item.id)) };
}

// Step 4: Natural-language Q&A
export async function answerInvestigationQuestion(question, investigation, alert, evidenceItems, crossRefResults) {
  const res = await base44.integrations.Core.InvokeLLM({
    prompt: `You are RAVIQEN, an AI risk and compliance analyst. Answer the investigator's question about this flagged transaction, grounded ONLY in the provided data.

Transaction: ${investigation?.title}
Vendor: ${investigation?.vendor}
Transaction ID: ${investigation?.transaction_id}
Risk Level: ${investigation?.risk_level}
Alert: ${alert?.description || "N/A"}
Flag reasons: ${(alert?.flag_reasons || []).join(", ")}
Evidence signals:
${(evidenceItems || []).map((e) => `- ${e.label}: ${e.value} (${e.severity})`).join("\n")}
Cross-referenced source records:
${(crossRefResults || []).map((r) => `- [${r.source_type}] ${r.record_type}: ${r.vendor}, $${r.amount}, status: ${r.match_status}`).join("\n")}

Investigator question: "${question}"

Answer concisely in 2-3 sentences. If the answer cannot be determined from the provided data, say so explicitly. Do not speculate.`,
    response_json_schema: {
      type: "object",
      properties: {
        answer: { type: "string" },
        can_answer: { type: "boolean" },
      },
    },
  });
  const parsed = typeof res === "string" ? { answer: res, can_answer: false } : (res || {});
  const source = JSON.stringify({ investigation, alert, evidenceItems, crossRefResults });
  if (!parsed.answer || !claimsAreGrounded(parsed.answer, source)) {
    return { answer: "That cannot be answered from the recorded investigation, alert, and evidence.", can_answer: false };
  }
  return { answer: parsed.answer, can_answer: parsed.can_answer !== false };
}

// Step 5: Auto-generate investigation report
export async function generateInvestigationReport(investigation, alert, evidenceItems, crossRefResults, recommendations, outcome, notes) {
  const res = await base44.integrations.Core.InvokeLLM({
    prompt: `You are RAVIQEN. Generate a formal investigation report for this concluded investigation.

Investigation: ${investigation?.title}
Transaction ID: ${investigation?.transaction_id}
Vendor: ${investigation?.vendor}
Risk Level: ${investigation?.risk_level}
Outcome: ${outcome}
Alert: ${alert?.description || "N/A"}
Flag reasons: ${(alert?.flag_reasons || []).join(", ")}

Evidence signals:
${(evidenceItems || []).map((e) => `- ${e.label}: ${e.value} (${e.severity})`).join("\n")}

Cross-referenced source records:
${(crossRefResults || []).map((r) => `- [${r.source_type}] ${r.record_type}: ${r.vendor}, $${r.amount}, status: ${r.match_status}`).join("\n")}

Recommended actions:
${(recommendations || []).map((r, i) => `${i + 1}. ${r.action || r} (${r.priority || ""})`).join("\n")}

Investigator notes: ${notes || "None recorded"}

Produce a structured Markdown report with these sections:
# Investigation Report
## 1. Executive Summary
## 2. Transaction Details
## 3. Evidence & Anomaly Signals
## 4. Source Data Cross-Reference
## 5. AI Risk Assessment
## 6. Recommended Actions
## 7. Investigator Notes
## 8. Conclusion & Outcome

Use professional, audit-ready language. Be specific and cite evidence signals by name.`,
  });
  return typeof res === "string" ? res : JSON.stringify(res, null, 2);
}

// Step 4 (advanced): Compliance Impact Analysis — maps transaction to regulatory frameworks
export async function generateComplianceAnalysis(investigation, alert, evidenceItems) {
  const res = await base44.integrations.Core.InvokeLLM({
    prompt: `You are RAVIQEN, an AI risk and compliance analyst. Map this flagged transaction to relevant compliance and regulatory frameworks.

Transaction: ${investigation?.title}
Vendor: ${investigation?.vendor}
Risk Level: ${investigation?.risk_level}
Alert: ${alert?.description || "N/A"}
Flag reasons: ${(alert?.flag_reasons || []).join(", ")}
Evidence signals:
${(evidenceItems || []).map((e) => `- ${e.label}: ${e.value} (${e.severity})`).join("\n")}

Identify which compliance frameworks are potentially implicated (e.g. AML/KYC, SOC 2, GDPR, PCI-DSS, OFAC sanctions, internal procurement policy, anti-fraud controls). For each, state the relevance level, the specific potential violation, and the requirement at stake. Then provide a one-sentence overall assessment.`,
    response_json_schema: {
      type: "object",
      properties: {
        frameworks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              framework: { type: "string" },
              relevance: { type: "string", enum: ["critical", "high", "medium", "low"] },
              potential_violation: { type: "string" },
              requirement: { type: "string" },
            },
          },
        },
        overall_assessment: { type: "string" },
      },
    },
  });
  return typeof res === "string" ? { frameworks: [], overall_assessment: res } : res;
}

// Step 4 (advanced): Financial Impact Estimation — estimates exposure and loss potential
export async function generateFinancialImpact(investigation, alert, transaction, evidenceItems) {
  const amount = transaction?.amount ?? alert?.amount ?? 0;
  const res = await base44.integrations.Core.InvokeLLM({
    prompt: `You are RAVIQEN, an AI risk and compliance analyst. Estimate the financial impact of this flagged transaction.

Transaction: ${investigation?.title}
Vendor: ${investigation?.vendor}
Transaction amount: $${amount}
Risk Level: ${investigation?.risk_level}
Flag reasons: ${(alert?.flag_reasons || []).join(", ")}
Evidence signals:
${(evidenceItems || []).map((e) => `- ${e.label}: ${e.value} (${e.severity})`).join("\n")}

Estimate the potential financial exposure (direct loss + recovery cost + reputational impact). Provide a point estimate, a low-high range, an impact category, the key contributing factors, and the value of mitigation actions taken. Be conservative and grounded in the data provided.`,
    response_json_schema: {
      type: "object",
      properties: {
        estimated_exposure: { type: "number" },
        exposure_range_low: { type: "number" },
        exposure_range_high: { type: "number" },
        impact_category: { type: "string", enum: ["minimal", "moderate", "significant", "severe"] },
        factors: { type: "array", items: { type: "string" } },
        mitigation_value: { type: "string" },
      },
    },
  });
  return groundFinancialImpact(amount);
}