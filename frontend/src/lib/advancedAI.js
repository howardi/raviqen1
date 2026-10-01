import { base44 } from "@/api/base44Client";
import { claimsAreGrounded, groundSanctionsResult } from "@/lib/llmGrounding";

// AI-powered sanctions screening — screens entity against known watchlists
export async function screenEntityAgainstSanctions(transaction) {
  const res = await base44.integrations.Core.InvokeLLM({
    prompt: `You are RAVIQEN's AI sanctions screening engine. Screen this transaction entity against known sanctions lists (OFAC, UN, EU, HMT).

Entity: ${transaction.vendor}
Transaction ID: ${transaction.transaction_id}
Amount: ${transaction.amount} ${transaction.currency || ""}
Location: ${transaction.location || "N/A"}
Category: ${transaction.category || "N/A"}
Payment Method: ${transaction.payment_method || "N/A"}

Analyze the entity name for potential matches against sanctioned individuals, organizations, or jurisdictions. Consider name similarity, geographic risk, transaction pattern anomalies, and industry risk factors.

Provide a screening result with match status, confidence score (0-100), matched list (if any), risk factors, and recommended action.`,
    response_json_schema: {
      type: "object",
      properties: {
        match_status: { type: "string", enum: ["confirmed", "possible", "cleared", "pending"] },
        confidence: { type: "number" },
        matched_list: { type: "string" },
        risk_factors: { type: "array", items: { type: "string" } },
        recommended_action: { type: "string" },
        screening_notes: { type: "string" },
      },
    },
  });
  return groundSanctionsResult(typeof res === "string" ? { screening_notes: res } : res);
}

// AI analytics insights — generates actionable insights from risk data
export async function generateInsightsNarrative(stats, anomalies, riskFactors) {
  const res = await base44.integrations.Core.InvokeLLM({
    prompt: `You are RAVIQEN's AI analytics engine. Generate actionable insights from the current risk data.

Current metrics:
- Total transactions: ${stats.totalTx}
- Flagged: ${stats.flagged}
- Critical: ${stats.critical}
- Total exposure amount as recorded: ${stats.exposure ?? "unavailable"}
- Average risk score: ${stats.avgRisk?.toFixed(1)}

Top anomalies:
${(anomalies || []).slice(0, 5).map((a, i) => `${i + 1}. ${a.transaction_id} — ${a.reasons.join(", ")} (${a.confidence}% confidence)`).join("\n") || "None"}

Risk factor scores:
${(riskFactors || []).map((f) => `- ${f.label}: ${f.score}/100 (weight ${f.weight}%)`).join("\n")}

State only patterns that are visible in the metrics and anomalies above. Do not predict events, name vendors, or cite amounts that are not in this data. Recommend human review only.`,
    response_json_schema: {
      type: "object",
      properties: {
        insights: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              severity: { type: "string", enum: ["info", "warning", "critical"] },
            },
          },
        },
        summary: { type: "string" },
      },
    },
  });
  const parsed = typeof res === "string" ? { insights: [], summary: res } : (res || { insights: [], summary: "" });
  const source = JSON.stringify({ stats, anomalies: (anomalies || []).slice(0, 5), riskFactors });
  const summary = claimsAreGrounded(parsed.summary, source)
    ? parsed.summary
    : `Flagged ${stats.flagged ?? 0} of ${stats.totalTx ?? 0} transactions. Critical count is ${stats.critical ?? 0}. Review the recorded anomalies only.`;
  const insights = (parsed.insights || []).filter((item) => claimsAreGrounded(`${item.title || ""} ${item.description || ""}`, source));
  return { insights, summary };
}

// AI network risk cluster detection — finds suspicious transaction groups
export async function detectRiskClusters(transactions) {
  const txSummary = (transactions || []).slice(0, 30).map((t) => ({
    vendor: t.vendor, amount: t.amount, currency: t.currency,
    location: t.location, risk_level: t.risk_level, risk_score: t.risk_score, category: t.category,
  }));
  const res = await base44.integrations.Core.InvokeLLM({
    prompt: `You are RAVIQEN's AI network analysis engine. Analyze these transactions and detect risk clusters — groups sharing suspicious patterns.

Transactions:
${JSON.stringify(txSummary, null, 2)}

Identify clusters linked by: same vendor with multiple high-risk transactions, similar amounts across vendors (structuring), geographic concentration, currency anomalies, or category-based patterns. For each cluster provide a name, entities involved, risk score, pattern description, and recommendation.`,
    response_json_schema: {
      type: "object",
      properties: {
        clusters: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              entities: { type: "array", items: { type: "string" } },
              risk_score: { type: "number" },
              pattern: { type: "string" },
              recommendation: { type: "string" },
            },
          },
        },
      },
    },
  });
  const parsed = typeof res === "string" ? { clusters: [] } : (res || {});
  const known = new Set(txSummary.map((row) => String(row.vendor || "").toLowerCase()).filter(Boolean));
  const source = JSON.stringify(txSummary);
  const clusters = (parsed.clusters || []).map((cluster) => ({
    ...cluster,
    entities: (cluster.entities || []).filter((name) => known.has(String(name).toLowerCase())),
  })).filter((cluster) => cluster.entities.length > 0 && claimsAreGrounded(`${cluster.pattern || ""} ${cluster.recommendation || ""}`, source));
  return { clusters };
}

// AI regulatory report generation (SAR/STR/CTR)
export async function generateSarStrReport(investigation, transaction, type) {
  const res = await base44.integrations.Core.InvokeLLM({
    prompt: `You are RAVIQEN's AI regulatory reporting engine. Generate a formal ${type} report for regulatory filing.

Investigation: ${investigation?.title}
Vendor: ${investigation?.vendor}
Transaction ID: ${investigation?.transaction_id}
Risk Level: ${investigation?.risk_level}
Outcome: ${investigation?.outcome}
AI Explanation: ${investigation?.ai_explanation || "N/A"}
Evidence Summary: ${investigation?.evidence_summary || "N/A"}

Transaction Details:
- Amount: ${transaction?.amount || "N/A"} ${transaction?.currency || ""}
- Date: ${transaction?.transaction_date || "N/A"}
- Location: ${transaction?.location || "N/A"}
- Payment Method: ${transaction?.payment_method || "N/A"}
- Category: ${transaction?.category || "N/A"}

Generate a formal ${type} report with sections: Filing Information, Subject Information, Suspicious Activity Description, Transaction Details, Basis for Filing, Supporting Documentation, and Recommended Follow-up Actions. Use formal regulatory language. Be specific and factual.`,
    response_json_schema: {
      type: "object",
      properties: {
        report_content: { type: "string" },
        filing_summary: { type: "string" },
        recommended_deadline: { type: "string" },
      },
    },
  });
  return typeof res === "string" ? { report_content: res, filing_summary: "", recommended_deadline: "" } : res;
}

// AI risk rule suggestions from anomaly patterns
export async function suggestRiskRules(anomalies, transactions) {
  const anomalySummary = (anomalies || []).slice(0, 10).map((a) => ({
    transaction_id: a.transaction_id, reasons: a.reasons, confidence: a.confidence,
  }));
  const res = await base44.integrations.Core.InvokeLLM({
    prompt: `You are RAVIQEN's AI risk rules engine. Analyze detected anomalies and suggest custom detection rules.

Detected anomalies:
${JSON.stringify(anomalySummary, null, 2)}

Transaction stats: ${transactions?.length || 0} total, ${transactions?.filter((t) => t.status === "flagged").length || 0} flagged, ${transactions?.filter((t) => ["high", "critical"].includes(t.risk_level)).length || 0} high risk.

Suggest 3-5 custom IF/THEN rules that would automatically flag similar transactions. Each rule needs a name, conditions (field/op/value), action, priority, and rationale.`,
    response_json_schema: {
      type: "object",
      properties: {
        rules: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              conditions: { type: "array", items: { type: "object", properties: { field: { type: "string" }, op: { type: "string" }, value: { type: "string" } } } },
              action: { type: "string" },
              priority: { type: "string", enum: ["low", "medium", "high", "critical"] },
              rationale: { type: "string" },
            },
          },
        },
      },
    },
  });
  return typeof res === "string" ? { rules: [] } : res;
}

// AI report generation for Reports & Exports
export async function generateReportContent(template, data) {
  const { transactions, alerts, investigations, dateFrom, dateTo } = data;
  const txSummary = (transactions || []).slice(0, 20).map((t) => ({ id: t.transaction_id, vendor: t.vendor, amount: t.amount, currency: t.currency, risk_level: t.risk_level, status: t.status }));
  const alertSummary = (alerts || []).slice(0, 10).map((a) => ({ title: a.title, risk_level: a.risk_level, status: a.status }));
  const invSummary = (investigations || []).slice(0, 10).map((i) => ({ title: i.title, status: i.status, outcome: i.outcome, risk_level: i.risk_level }));
  const templateDesc = {
    exec_summary: "Executive Summary Report — high-level risk overview for leadership",
    investigation: "Investigation Report — full standardized investigation output",
    sar_str: "SAR / STR Filing — regulatory filing document",
    risk_assessment: "Risk Assessment Report — comprehensive risk scoring and factor analysis",
    compliance: "Compliance Audit Report — framework compliance status and gaps",
  };
  const res = await base44.integrations.Core.InvokeLLM({
    prompt: `You are RAVIQEN's AI report generator. Generate a formal ${templateDesc[template] || "report"}.

Date range: ${dateFrom || "N/A"} to ${dateTo || "N/A"}
Transactions (${transactions?.length || 0}): ${JSON.stringify(txSummary, null, 2)}
Alerts (${alerts?.length || 0}): ${JSON.stringify(alertSummary, null, 2)}
Investigations (${investigations?.length || 0}): ${JSON.stringify(invSummary, null, 2)}

Generate a comprehensive, professional report with executive summary, key findings, risk assessment, recommendations, and appendices. Use formal language with clear section headers.`,
  });
  return typeof res === "string" ? res : JSON.stringify(res, null, 2);
}

// AI integration recommendations
export async function suggestIntegrations(transactions) {
  const vendors = [...new Set((transactions || []).map((t) => t.vendor).filter(Boolean))];
  const categories = [...new Set((transactions || []).map((t) => t.category).filter(Boolean))];
  const currencies = [...new Set((transactions || []).map((t) => t.currency).filter(Boolean))];
  const res = await base44.integrations.Core.InvokeLLM({
    prompt: `You are RAVIQEN's AI integration advisor. Based on the current transaction data, recommend data source integrations.

Data profile: ${transactions?.length || 0} transactions, ${vendors.length} vendors, categories: ${categories.join(", ")}, currencies: ${currencies.join(", ")}.

Recommend 3 integrations that would fill data gaps or enhance risk detection. For each: name, category, reason (specific to data profile), priority, and what data it provides.`,
    response_json_schema: {
      type: "object",
      properties: {
        recommendations: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              category: { type: "string" },
              reason: { type: "string" },
              priority: { type: "string", enum: ["high", "medium", "low"] },
              data_provided: { type: "string" },
            },
          },
        },
      },
    },
  });
  return typeof res === "string" ? { recommendations: [] } : res;
}

// AI case priority scoring
export async function scoreCasePriority(investigations) {
  const cases = (investigations || []).slice(0, 30).map((i) => ({
    id: i.id, title: i.title, vendor: i.vendor, risk_level: i.risk_level,
    status: i.status, outcome: i.outcome, ai_confidence: i.ai_confidence,
  }));
  const res = await base44.integrations.Core.InvokeLLM({
    prompt: `You are RAVIQEN's AI case prioritization engine. Score and rank these investigations by urgency.

Cases:
${JSON.stringify(cases, null, 2)}

For each case, provide a priority score (0-100) and a brief rationale. Consider risk level, outcome, AI confidence, and status. Higher scores = more urgent.`,
    response_json_schema: {
      type: "object",
      properties: {
        scores: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              priority_score: { type: "number" },
              rationale: { type: "string" },
            },
          },
        },
      },
    },
  });
  return typeof res === "string" ? { scores: [] } : res;
}