import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { assertOversightManager, writeOversightAudit } from '../../shared/oversight.ts';

function numericClaims(text: string) {
  return (String(text || "").match(/\d[\d,]*(?:\.\d+)?/g) || [])
    .map((value) => value.replace(/,/g, ""))
    .filter((value) => value.includes(".") || value.length >= 2);
}

function claimsAreGrounded(text: string, source: string) {
  if (/\b(cleared|clearance|whitelisted|safe to pay|release payment|disburse)\b/i.test(text)) return false;
  const hay = String(source || "").replace(/,/g, "");
  return numericClaims(text).every((value) => hay.includes(value));
}

function deterministicFindings(payload) {
  const findings = [];
  const byDepartment = new Map();
  for (const row of payload) {
    const list = byDepartment.get(row.department) || [];
    list.push(row);
    byDepartment.set(row.department, list);
    for (const [key, value] of Object.entries(row.metrics || {})) {
      const amount = Number(value);
      if (Number.isFinite(amount) && amount < 0) {
        findings.push({
          source_id: row.id,
          category: "Financial anomalies and ledger inconsistencies",
          attention: `${key} is ${amount} on ${row.date || "the report date"}.`,
          where: row.department || "the reporting department",
          when: "Before this report is ingested.",
          observation: `${key} is ${amount} on ${row.date || "the report date"}.`,
          follow_up: "Confirm the source figure before treating the report as fact.",
        });
      }
    }
  }
  for (const rows of byDepartment.values()) {
    for (let index = 1; index < rows.length; index += 1) {
      const previous = rows[index - 1];
      const current = rows[index];
      for (const key of Object.keys(current.metrics || {})) {
        const before = Number(previous.metrics?.[key]);
        const after = Number(current.metrics?.[key]);
        if (!Number.isFinite(before) || !Number.isFinite(after) || before === 0) continue;
        if (Math.abs(after - before) / Math.abs(before) >= 2) {
          const money = /sales|revenue|payment|receipt|cash|price/.test(key);
          const procurement = /stock|purchase|supplier|price/.test(key);
          findings.push({
            source_id: current.id,
            category: procurement
              ? "Procurement irregularities"
              : money
                ? "Financial anomalies and ledger inconsistencies"
                : "Operational exceptions",
            attention: `${key} moved from ${before} to ${after}.`,
            where: `${current.department || "this department"}, between ${previous.date || previous.id} and ${current.date || current.id}`,
            when: "Before the later report is treated as the department record.",
            observation: `${key} moved from ${before} to ${after} between ${previous.date || previous.id} and ${current.date || current.id}.`,
            follow_up: `Compare report ${previous.id} with ${current.id} using the source documents.`,
          });
        }
      }
    }
  }
  return findings;
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const gate = assertOversightManager(user);
    if (gate.error) return Response.json({ error: gate.error }, { status: gate.status });
    const body = await req.json().catch(() => ({}));
    const department = body.department ? String(body.department) : '';
    const filter = department
      ? { tenant_id: gate.tenantId, department }
      : { tenant_id: gate.tenantId };
    const rows = await base44.asServiceRole.entities.RavenIngestion.filter(filter, '-created_date', 40);
    const scoped = rows.filter((row) => row.tenant_id === gate.tenantId && (!department || row.department === department));
    const payload = scoped.slice(0, 30).map((r) => ({
      id: r.source_report_id,
      department: r.department,
      date: r.report_date,
      metrics: r.metrics,
      notes: String(r.content || '').slice(0, 700),
    }));
    if (!payload.length) return Response.json({ findings: [], error: 'Ingest reports before running analysis.' }, { status: 400 });
    const res = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Identify trends, variances, inconsistencies and follow-up questions from ONLY these manager-approved records for tenant analysis. Do not infer missing amounts, budgets, prices or facts. Each finding MUST cite one input id. No clearance decisions. Scope: ${department || 'all ingested departments'}. Data: ${JSON.stringify(payload)}`,
      response_json_schema: {
        type: 'object',
        properties: {
          findings: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                source_id: { type: 'string' },
                observation: { type: 'string' },
                follow_up: { type: 'string' },
              },
            },
          },
        },
      },
    });
    const byId = new Map(payload.map((row) => [row.id, JSON.stringify(row)]));
    const modelFindings = (res.findings || []).filter((finding) => {
      const source = byId.get(finding.source_id);
      const text = `${finding.observation || ""} ${finding.follow_up || ""}`;
      return source && finding.observation && claimsAreGrounded(text, source);
    });
    const findings = [...deterministicFindings(payload), ...modelFindings].slice(0, 8);
    await writeOversightAudit(base44, { tenantId: gate.tenantId, actor: user, action: 'ai_analysis', entityType: 'RavenIngestion', after: { department: department || 'all', findings: findings.length } });
    return Response.json({ findings });
  } catch (error) {
    return Response.json({ error: error.message || 'Unable to analyse reports.' }, { status: 500 });
  }
}
