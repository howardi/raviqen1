import { base44 } from "@/api/base44Client";

// OSINT Adverse Media Scanning — uses LLM with web search to find negative news about vendors

export async function scanVendorAdverseMedia(vendorName, options = {}) {
  const prompt = `You are an OSINT (Open Source Intelligence) adverse media screening analyst. Search for any negative news, legal actions, regulatory violations, sanctions, or adverse media related to the entity: "${vendorName}".

Look for:
1. Financial crimes (fraud, money laundering, embezzlement)
2. Regulatory violations (SEC, FINRA, FCA, or local regulators)
3. Legal actions (lawsuits, criminal charges, judgments)
4. Sanctions listings (OFAC, EU, UN, or other sanctions bodies)
5. Reputational issues (scandals, negative press, investigations)
6. Political exposure (PEP connections)

For each finding, provide:
- headline: the headline or title
- source: the publication or source name
- date: when it was published (if known)
- category: one of [financial_crime, regulatory, legal, sanctions, reputational, political]
- severity: one of [low, medium, high, critical]
- url: source URL if available
- summary: brief description

Also provide:
- overall_risk_rating: one of [clear, low, medium, high, critical]
- recommended_action: what the compliance team should do next
- summary: a 2-3 sentence executive summary of the entity's risk profile`;

  const res = await base44.integrations.Core.InvokeLLM({
    prompt,
    add_context_from_internet: true,
    model: "gemini_3_flash",
    response_json_schema: {
      type: "object",
      properties: {
        overall_risk_rating: { type: "string", enum: ["clear", "low", "medium", "high", "critical"] },
        findings: {
          type: "array",
          items: {
            type: "object",
            properties: {
              headline: { type: "string" },
              source: { type: "string" },
              date: { type: "string" },
              category: { type: "string" },
              severity: { type: "string" },
              url: { type: "string" },
              summary: { type: "string" },
            },
          },
        },
        recommended_action: { type: "string" },
        summary: { type: "string" },
      },
    },
  });

  const result = typeof res === "string" ? JSON.parse(res) : res;

  return {
    vendor: vendorName,
    scan_date: new Date().toISOString(),
    status: "completed",
    risk_rating: result.overall_risk_rating || "clear",
    findings: result.findings || [],
    findings_count: (result.findings || []).length,
    categories: [...new Set((result.findings || []).map((f) => f.category))],
    summary: result.summary || "No adverse media found.",
    recommended_action: result.recommended_action || "Continue monitoring.",
    scanned_by: options.scannedBy || "System",
  };
}

export async function batchScanVendors(vendors, options = {}) {
  const results = [];
  for (const vendor of vendors) {
    try {
      const scan = await scanVendorAdverseMedia(vendor, options);
      results.push(scan);
    } catch (err) {
      results.push({
        vendor,
        scan_date: new Date().toISOString(),
        status: "failed",
        risk_rating: "clear",
        findings: [],
        findings_count: 0,
        categories: [],
        summary: `Scan failed: ${err.message}`,
        recommended_action: "Retry scan manually.",
        scanned_by: options.scannedBy || "System",
      });
    }
  }
  return results;
}

export const SEVERITY_CONFIG = {
  critical: { label: "Critical", classes: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" },
  high: { label: "High", classes: "bg-orange-50 text-orange-700 border-orange-200", dot: "bg-orange-500" },
  medium: { label: "Medium", classes: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  low: { label: "Low", classes: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  clear: { label: "Clear", classes: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
};

export const CATEGORY_ICONS = {
  financial_crime: "DollarSign",
  regulatory: "Landmark",
  legal: "Gavel",
  sanctions: "Ban",
  reputational: "Newspaper",
  political: "Landmark",
};