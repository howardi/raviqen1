import { base44 } from "@/api/base44Client";

// Vendor Identity Verification — KYC/KYB verification engine

export async function runVendorKYB(vendorName, options = {}) {
  const prompt = `You are a KYB (Know Your Business) verification analyst. Research the business entity "${vendorName}" and provide a comprehensive identity verification assessment.

Determine:
1. Business registration details (registration number, country of incorporation, incorporation date)
2. Beneficial owners (UBOs with >25% ownership)
3. Key principals and directors
4. Sanctions screening result (OFAC, EU, UN sanctions lists)
5. PEP (Politically Exposed Person) screening result
6. Adverse media check
7. Overall identity confidence score (0-100)

Provide a risk assessment explaining any concerns and recommending verification status: verified, flagged, or rejected.`;

  const res = await base44.integrations.Core.InvokeLLM({
    prompt,
    add_context_from_internet: true,
    model: "gemini_3_flash",
    response_json_schema: {
      type: "object",
      properties: {
        registration_number: { type: "string" },
        country_of_incorporation: { type: "string" },
        incorporation_date: { type: "string" },
        beneficial_owners: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              ownership_percentage: { type: "number" },
              nationality: { type: "string" },
              pep_status: { type: "string" },
            },
          },
        },
        sanctions_check: { type: "string", enum: ["clear", "match", "partial_match", "not_checked"] },
        pep_check: { type: "string", enum: ["clear", "match", "not_checked"] },
        identity_score: { type: "number" },
        verification_status: { type: "string", enum: ["verified", "flagged", "rejected"] },
        risk_assessment: { type: "string" },
        recommended_documents: { type: "array", items: { type: "string" } },
      },
    },
  });

  const result = typeof res === "string" ? JSON.parse(res) : res;
  return {
    vendor: vendorName,
    verification_status: result.verification_status || "pending",
    kyb_status: "completed",
    identity_score: result.identity_score || 0,
    registration_number: result.registration_number || "",
    country_of_incorporation: result.country_of_incorporation || "",
    beneficial_owners: result.beneficial_owners || [],
    sanctions_check: result.sanctions_check || "not_checked",
    pep_check: result.pep_check || "not_checked",
    risk_assessment: result.risk_assessment || "Assessment pending.",
    documents: (result.recommended_documents || []).map((doc) => ({ type: doc, status: "requested" })),
    verified_by: options.verifiedBy || "System",
    verification_date: new Date().toISOString().split("T")[0],
  };
}

export function computeIdentityScore(verification) {
  let score = 0;
  if (verification.registration_number) score += 20;
  if (verification.country_of_incorporation) score += 15;
  if (verification.sanctions_check === "clear") score += 25;
  else if (verification.sanctions_check === "partial_match") score -= 20;
  else if (verification.sanctions_check === "match") score -= 50;
  if (verification.pep_check === "clear") score += 20;
  const ownerCount = (verification.beneficial_owners || []).length;
  score += Math.min(20, ownerCount * 10);
  return Math.max(0, Math.min(100, score));
}

export const VERIFICATION_STATUS_CONFIG = {
  pending: { label: "Pending", classes: "bg-slate-100 text-slate-600", icon: "Clock" },
  in_progress: { label: "In Progress", classes: "bg-blue-100 text-blue-700", icon: "Loader" },
  verified: { label: "Verified", classes: "bg-emerald-100 text-emerald-700", icon: "ShieldCheck" },
  flagged: { label: "Flagged", classes: "bg-amber-100 text-amber-700", icon: "ShieldAlert" },
  rejected: { label: "Rejected", classes: "bg-red-100 text-red-700", icon: "ShieldX" },
};

export const KYB_QUESTIONS = [
  { id: "reg_number", label: "Business Registration Number", type: "text", required: true },
  { id: "incorp_date", label: "Date of Incorporation", type: "date", required: true },
  { id: "country", label: "Country of Incorporation", type: "text", required: true },
  { id: "registered_address", label: "Registered Business Address", type: "text", required: true },
  { id: "ubo_name", label: "Ultimate Beneficial Owner (Name)", type: "text", required: true },
  { id: "ubo_ownership", label: "UBO Ownership %", type: "number", required: true },
  { id: "ubo_nationality", label: "UBO Nationality", type: "text", required: true },
  { id: "annual_revenue", label: "Annual Revenue (USD)", type: "number", required: false },
  { id: "business_nature", label: "Nature of Business", type: "textarea", required: true },
];