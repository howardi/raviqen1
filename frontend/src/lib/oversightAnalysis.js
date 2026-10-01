import { base44 } from "@/api/base44Client";
import { claimsAreGrounded } from "@/lib/llmGrounding";
import { invokeLiveLLM } from "@/lib/liveAI";
import { findingsFromIngested } from "@/lib/oversightFindings";

export { findingsFromIngested };

export async function analyzeOversightLive({ department, tenantId }) {
  if (!tenantId) return { findings: [], error: "Assign your organization before running analysis." };
  const filter = department ? { tenant_id: tenantId, department } : { tenant_id: tenantId };
  const rows = await base44.entities.RavenIngestion.filter(filter, "-created_date", 40);
  const scoped = (rows || []).filter((row) => row.tenant_id === tenantId && (!department || row.department === department)).slice(0, 30);
  if (!scoped.length) return { findings: [], error: "Ingest reports before running analysis." };
  const recorded = findingsFromIngested(scoped);
  const payload = scoped.map((row) => ({
    id: row.source_report_id || row.id,
    department: row.department,
    date: row.report_date,
    metrics: row.metrics,
  }));
  try {
    const model = await invokeLiveLLM({
      prompt: `Identify trends and inconsistencies from ONLY these ingested records. Do not infer missing amounts. Each finding must cite one input id. Data: ${JSON.stringify(payload)}`,
      response_json_schema: {
        type: "object",
        properties: {
          findings: {
            type: "array",
            items: {
              type: "object",
              properties: {
                source_id: { type: "string" },
                observation: { type: "string" },
                follow_up: { type: "string" },
              },
            },
          },
        },
      },
    });
    const byId = new Map(payload.map((row) => [row.id, JSON.stringify(row)]));
    const grounded = (model?.findings || []).filter((finding) => {
      const source = byId.get(finding.source_id);
      return source && claimsAreGrounded(`${finding.observation || ""} ${finding.follow_up || ""}`, source);
    }).map((finding) => ({
      ...finding,
      attention: finding.observation,
      where: payload.find((row) => row.id === finding.source_id)?.department || department || "ingested records",
      when: finding.follow_up || "Before the next management review.",
    }));
    return { findings: [...recorded, ...grounded].slice(0, 8) };
  } catch (error) {
    return { findings: recorded, note: recorded.length ? "Showing findings from the ingested figures. The language model is not configured yet." : error.message };
  }
}
