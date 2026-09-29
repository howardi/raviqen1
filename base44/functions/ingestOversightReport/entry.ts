import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { assertOversightManager, writeOversightAudit } from '../../shared/oversight.ts';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const gate = assertOversightManager(user);
    if (gate.error) return Response.json({ error: gate.error }, { status: gate.status });
    const body = await req.json();
    const reportId = String(body.report_id || '');
    const action = body.action === 'reject' ? 'reject' : body.action === 'review' ? 'review' : 'ingest';
    if (!reportId) return Response.json({ error: 'Report is required.' }, { status: 400 });
    const reports = await base44.asServiceRole.entities.DailyReport.filter({ id: reportId, tenant_id: gate.tenantId });
    const report = reports[0];
    if (!report) return Response.json({ error: 'Report not found.' }, { status: 404 });
    if (report.tenant_id !== gate.tenantId) return Response.json({ error: 'Forbidden.' }, { status: 403 });
    if (action === 'reject') {
      const reason = String(body.reason || '').trim();
      if (!reason) return Response.json({ error: 'A rejection reason is required.' }, { status: 400 });
      await base44.asServiceRole.entities.DailyReport.update(report.id, { ingestion_status: 'rejected', rejection_reason: reason });
      await writeOversightAudit(base44, { tenantId: gate.tenantId, actor: user, action: 'report_reject', entityType: 'DailyReport', entityId: report.id, before: { ingestion_status: report.ingestion_status }, after: { ingestion_status: 'rejected', reason } });
      return Response.json({ id: report.id, ingestion_status: 'rejected' });
    }
    if (action === 'review') {
      await base44.asServiceRole.entities.DailyReport.update(report.id, { ingestion_status: 'reviewed', read_by: [...new Set([...(report.read_by || []), user.id])] });
      await writeOversightAudit(base44, { tenantId: gate.tenantId, actor: user, action: 'report_review', entityType: 'DailyReport', entityId: report.id });
      return Response.json({ id: report.id, ingestion_status: 'reviewed' });
    }
    const existing = await base44.asServiceRole.entities.RavenIngestion.filter({ tenant_id: gate.tenantId, source_report_id: report.id });
    if (!existing.length) {
      await base44.asServiceRole.entities.RavenIngestion.create({
        tenant_id: gate.tenantId,
        source_report_id: report.id,
        department: report.department,
        report_date: report.report_date,
        title: report.title,
        content: report.content,
        metrics: report.metrics || {},
        submitted_by: report.submitted_by || '',
        reviewed_by_id: user.id,
        reviewed_at: new Date().toISOString(),
      });
    }
    await base44.asServiceRole.entities.DailyReport.update(report.id, {
      ingestion_status: 'ingested',
      read_by: [...new Set([...(report.read_by || []), user.id])],
    });
    await writeOversightAudit(base44, { tenantId: gate.tenantId, actor: user, action: 'report_ingest', entityType: 'DailyReport', entityId: report.id, after: { department: report.department } });
    return Response.json({ id: report.id, ingestion_status: 'ingested' });
  } catch (error) {
    return Response.json({ error: error.message || 'Unable to update report.' }, { status: 500 });
  }
}
