import { base44 } from "@/api/base44Client";

// Regulatory Horizon Scanning — monitors upcoming regulatory changes and assesses compliance impact

export async function scanRegulatoryHorizon(jurisdictions = ["US", "EU", "UK", "Global"]) {
  const prompt = `You are a regulatory horizon scanning analyst. Search for recent and upcoming regulatory changes, new legislation, and compliance requirements that may impact financial institutions and payment processors.

Focus on jurisdictions: ${jurisdictions.join(", ")}

Look for:
1. New AML/KYC regulations
2. Sanctions and export control updates
3. Data protection and privacy laws
4. Financial reporting standards changes
5. Consumer protection regulations
6. Tax reporting requirements
7. Crypto/digital asset regulations

For each regulatory update found, provide:
- title: the regulation or update name
- jurisdiction: the applicable jurisdiction
- regulator: the issuing authority
- category: one of [aml, sanctions, data_protection, financial_reporting, consumer_protection, tax, other]
- effective_date: when it takes effect (YYYY-MM-DD or "TBD")
- impact_level: one of [low, medium, high, critical]
- summary: brief description of the requirement
- affected_areas: list of business areas impacted
- required_actions: list of compliance actions needed
- source_url: link to the official source

Prioritize the most recent and highest-impact updates. Return up to 10 items.`;

  const res = await base44.integrations.Core.InvokeLLM({
    prompt,
    add_context_from_internet: true,
    model: "gemini_3_flash",
    response_json_schema: {
      type: "object",
      properties: {
        updates: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              jurisdiction: { type: "string" },
              regulator: { type: "string" },
              category: { type: "string" },
              effective_date: { type: "string" },
              impact_level: { type: "string" },
              summary: { type: "string" },
              affected_areas: { type: "array", items: { type: "string" } },
              required_actions: { type: "array", items: { type: "string" } },
              source_url: { type: "string" },
            },
          },
        },
      },
    },
  });

  const result = typeof res === "string" ? JSON.parse(res) : res;
  return (result.updates || []).map((u) => ({
    ...u,
    status: "new",
  }));
}

export async function analyzeRegulatoryImpact(update, businessProfile = {}) {
  const prompt = `You are a compliance impact analyst. Assess how the following regulatory change impacts a financial risk monitoring platform (RAVIQEN) that handles transaction monitoring, vendor KYC/KYB, sanctions screening, and regulatory reporting.

Regulatory Update:
- Title: ${update.title}
- Jurisdiction: ${update.jurisdiction}
- Regulator: ${update.regulator}
- Category: ${update.category}
- Effective Date: ${update.effective_date}
- Summary: ${update.summary}
- Required Actions: ${(update.required_actions || []).join(", ")}

Business Profile:
- Industry: Financial Risk & Compliance
- Services: Transaction monitoring, KYC/KYB, Sanctions screening, Regulatory reporting
- Current coverage: ${(businessProfile.coverage || "Standard AML/CTF compliance")}

Provide:
1. ai_analysis: A 3-4 sentence impact assessment explaining what RAVIQEN must do to comply
2. gap_assessment: What's already covered vs. what needs to be built
3. priority: one of [immediate, short_term, long_term]
4. estimated_effort: one of [low, medium, high, critical]
5. recommended_actions: specific steps to achieve compliance`;

  const res = await base44.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: {
      type: "object",
      properties: {
        ai_analysis: { type: "string" },
        gap_assessment: { type: "string" },
        priority: { type: "string" },
        estimated_effort: { type: "string" },
        recommended_actions: { type: "array", items: { type: "string" } },
      },
    },
  });

  const result = typeof res === "string" ? { ai_analysis: res, gap_assessment: "", priority: "short_term", estimated_effort: "medium", recommended_actions: [] } : res;

  return {
    ...update,
    ai_analysis: result.ai_analysis || update.summary,
    status: "assessing",
  };
}

export const CATEGORY_CONFIG = {
  aml: { label: "AML / CTF", classes: "bg-red-100 text-red-700", icon: "ShieldX" },
  sanctions: { label: "Sanctions", classes: "bg-orange-100 text-orange-700", icon: "Ban" },
  data_protection: { label: "Data Protection", classes: "bg-blue-100 text-blue-700", icon: "Lock" },
  financial_reporting: { label: "Financial Reporting", classes: "bg-purple-100 text-purple-700", icon: "FileText" },
  consumer_protection: { label: "Consumer Protection", classes: "bg-emerald-100 text-emerald-700", icon: "Users" },
  tax: { label: "Tax", classes: "bg-amber-100 text-amber-700", icon: "Receipt" },
  other: { label: "Other", classes: "bg-slate-100 text-slate-600", icon: "FileWarning" },
};

export const IMPACT_CONFIG = {
  critical: { label: "Critical", classes: "bg-red-50 text-red-700 border-red-200" },
  high: { label: "High", classes: "bg-orange-50 text-orange-700 border-orange-200" },
  medium: { label: "Medium", classes: "bg-amber-50 text-amber-700 border-amber-200" },
  low: { label: "Low", classes: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

export const STATUS_CONFIG = {
  new: { label: "New", classes: "bg-blue-100 text-blue-700" },
  assessing: { label: "Assessing", classes: "bg-amber-100 text-amber-700" },
  action_required: { label: "Action Required", classes: "bg-red-100 text-red-700" },
  compliant: { label: "Compliant", classes: "bg-emerald-100 text-emerald-700" },
  archived: { label: "Archived", classes: "bg-slate-100 text-slate-500" },
};