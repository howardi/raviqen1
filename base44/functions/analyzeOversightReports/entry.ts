import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { assertOversightManager, writeOversightAudit } from '../../shared/oversight.ts';

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
    const ids = new Set(payload.map((x) => x.id));
    const findings = (res.findings || []).filter((f) => ids.has(f.source_id) && f.observation).slice(0, 8);
    await writeOversightAudit(base44, { tenantId: gate.tenantId, actor: user, action: 'ai_analysis', entityType: 'RavenIngestion', after: { department: department || 'all', findings: findings.length } });
    return Response.json({ findings });
  } catch (error) {
    return Response.json({ error: error.message || 'Unable to analyse reports.' }, { status: 500 });
  }
}
