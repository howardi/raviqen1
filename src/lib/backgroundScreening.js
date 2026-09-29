import { base44 } from "@/api/base44Client";

// Background Screening Engine
// Simulates checks against public databases, identity registries, and watchlists

const CHECKS = [
  { key: "identity_verification", name: "Identity Verification", weight: 25 },
  { key: "criminal_record_check", name: "Criminal Record Check", weight: 25 },
  { key: "past_employment_check", name: "Past Employment Verification", weight: 15 },
  { key: "education_verification", name: "Education Verification", weight: 10 },
  { key: "sanctions_check", name: "Sanctions / Watchlist Check", weight: 15 },
  { key: "credit_check", name: "Credit History Check", weight: 10 },
];

// Deterministic pseudo-random based on input string (for reproducible screening)
function seededRandom(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(Math.sin(hash) * 10000) % 1;
}

export async function runBackgroundScreening(candidate, user) {
  const { base44: _b, ...candidateData } = candidate;
  const seed = `${candidate.candidate_name}${candidate.national_id}${candidate.tax_number || ""}`;
  const results = [];
  const flags = [];
  let riskScore = 0;

  for (const check of CHECKS) {
    const rng = seededRandom(seed + check.key);
    let status;
    let details = "";

    // Each check has different probability distributions
    if (check.key === "identity_verification") {
      if (rng < 0.75) { status = "verified"; details = "Identity confirmed against national registry."; }
      else if (rng < 0.9) { status = "mismatch"; details = "Name/ID mismatch detected — requires manual verification."; flags.push("Identity mismatch"); riskScore += 20; }
      else { status = "failed"; details = "Unable to verify identity — registry lookup failed."; flags.push("Identity verification failed"); riskScore += 35; }
    } else if (check.key === "criminal_record_check") {
      if (rng < 0.8) { status = "clear"; details = "No criminal records found."; }
      else if (rng < 0.93) { status = "flagged"; details = "Minor offense record found — review required."; flags.push("Criminal record flagged"); riskScore += 30; }
      else { status = "failed"; details = "Serious criminal record found."; flags.push("Serious criminal record"); riskScore += 50; }
    } else if (check.key === "past_employment_check") {
      if (rng < 0.7) { status = "verified"; details = "Employment history confirmed."; }
      else if (rng < 0.9) { status = "discrepancy"; details = "Employment dates or title discrepancy detected."; flags.push("Employment history discrepancy"); riskScore += 15; }
      else { status = "failed"; details = "Previous employer could not be contacted or denied employment."; flags.push("Unverifiable employment"); riskScore += 25; }
    } else if (check.key === "education_verification") {
      if (rng < 0.75) { status = "verified"; details = "Educational credentials confirmed."; }
      else if (rng < 0.92) { status = "discrepancy"; details = "Degree or institution could not be fully verified."; flags.push("Education discrepancy"); riskScore += 10; }
      else { status = "failed"; details = "Fraudulent credential detected."; flags.push("Fake credential"); riskScore += 30; }
    } else if (check.key === "sanctions_check") {
      if (rng < 0.9) { status = "clear"; details = "No sanctions or watchlist matches."; }
      else if (rng < 0.97) { status = "partial_match"; details = "Partial name match on watchlist — manual review needed."; flags.push("Watchlist partial match"); riskScore += 25; }
      else { status = "match"; details = "Full match found on sanctions watchlist."; flags.push("Sanctions watchlist match"); riskScore += 60; }
    } else if (check.key === "credit_check") {
      if (rng < 0.8) { status = "clear"; details = "Credit history satisfactory."; }
      else if (rng < 0.95) { status = "flagged"; details = "Adverse credit history detected."; flags.push("Adverse credit history"); riskScore += 10; }
      else { status = "failed"; details = "Severe credit default or bankruptcy."; flags.push("Severe credit issues"); riskScore += 20; }
    }

    results.push({ check_name: check.name, check_key: check.key, status, details });
  }

  riskScore = Math.min(riskScore, 100);
  const riskLevel = riskScore >= 75 ? "critical" : riskScore >= 55 ? "high" : riskScore >= 30 ? "medium" : "low";
  const overallStatus = riskScore >= 75 ? "rejected" : riskScore >= 30 ? "flagged" : "cleared";

  // Generate AI assessment
  let aiAssessment = "";
  let recommendations = [];
  try {
    const prompt = `You are a background screening analyst. Analyze this candidate screening result and provide a concise risk assessment.

Candidate: ${candidate.candidate_name}
Position: ${candidate.position_applied || "Not specified"}
Risk Score: ${riskScore}/100 (${riskLevel})
Flags: ${flags.join(", ") || "None"}

Screening Results:
${results.map((r) => `- ${r.check_name}: ${r.status} — ${r.details}`).join("\n")}

Provide:
1. A 2-3 sentence executive risk assessment
2. 2-3 specific hiring recommendations (proceed with caution, additional verification needed, do not proceed, etc.)`;

    const aiResult = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          assessment: { type: "string" },
          recommendations: { type: "array", items: { type: "string" } },
        },
      },
    });
    aiAssessment = aiResult.assessment || "";
    recommendations = aiResult.recommendations || [];
  } catch (e) {
    aiAssessment = `${candidate.candidate_name} scored ${riskScore}/100 (${riskLevel} risk). ${flags.length > 0 ? `Key concerns: ${flags.join(", ")}.` : "No significant flags detected."} ${overallStatus === "cleared" ? "Candidate is recommended to proceed." : overallStatus === "flagged" ? "Additional verification recommended before hiring." : "Hiring not recommended."}`;
    recommendations = overallStatus === "cleared"
      ? ["Proceed with hiring", "Standard onboarding process"]
      : overallStatus === "flagged"
      ? ["Conduct additional manual verification", "Request candidate explanation for flagged items", "Escalate to HR management for final decision"]
      : ["Do not proceed with hiring", "Document screening results", "Escalate to compliance team"];
  }

  return {
    identity_verification: results.find((r) => r.check_key === "identity_verification")?.status || "pending",
    criminal_record_check: results.find((r) => r.check_key === "criminal_record_check")?.status || "pending",
    past_employment_check: results.find((r) => r.check_key === "past_employment_check")?.status || "pending",
    education_verification: results.find((r) => r.check_key === "education_verification")?.status || "pending",
    sanctions_check: results.find((r) => r.check_key === "sanctions_check")?.status || "pending",
    credit_check: results.find((r) => r.check_key === "credit_check")?.status || "pending",
    overall_status: overallStatus,
    risk_score: riskScore,
    risk_level: riskLevel,
    flags,
    screening_results: results,
    ai_assessment: aiAssessment,
    recommendations,
    screened_by: user?.full_name || user?.email || "System",
    screening_date: new Date().toISOString(),
    status: "completed",
  };
}