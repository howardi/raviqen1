import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { getTenantId } from '../../shared/tenantAuth.ts';
import { isOversightManager, isDisabled, oversightRole, writeOversightAudit } from '../../shared/oversight.ts';
import { analyzeReportFraud } from '../../shared/reportFraud.ts';

const ALLOWED_HOSTS = ['base44.com', 'base44.app'];

function validUrl(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === 'https:' && ALLOWED_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Sign in to submit a report.' }, { status: 401 });
    if (isDisabled(user) || !getTenantId(user)) {
      return Response.json({ error: 'Your account needs an active organization.' }, { status: 403 });
    }
    const role = oversightRole(user);
    if (role === 'pending') {
      return Response.json({ error: 'Awaiting department assignment.' }, { status: 403 });
    }
    const tenantId = getTenantId(user);
    const body = await req.json();
    const departments = await base44.asServiceRole.entities.OversightDepartment.filter({ tenant_id: tenantId, active: true }, 'sort_order', 100);
    const allowed = departments.length
      ? departments
      : [{ slug: user.department, active: true, purchases_enabled: user.department === 'procurement' }];
    const requested = String(body.department || user.department || '');
    const department = isOversightManager(user) ? requested : String(user.department || '');
    const dept = allowed.find((d) => d.slug === department);
    if (!dept || department === 'general') {
      return Response.json({ error: 'Ask your manager to assign your department.' }, { status: 403 });
    }
    if (!isOversightManager(user) && requested && requested !== department) {
      return Response.json({ error: 'You can only submit for your assigned department.' }, { status: 403 });
    }
    const title = String(body.title || '').trim();
    const content = String(body.content || '').trim();
    const reportDate = String(body.report_date || '');
    if (!title || !content || title.length > 200 || content.length > 20000 || !/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) {
      return Response.json({ error: 'Enter a title, report date, and report content.' }, { status: 400 });
    }
    const metrics = body.metrics && typeof body.metrics === 'object' ? body.metrics : {};
    const fileUrls = Array.isArray(body.file_urls) ? body.file_urls.filter(validUrl).slice(0, 8) : [];
    const existing = await base44.asServiceRole.entities.DailyReport.filter({
      tenant_id: tenantId,
      department,
      report_date: reportDate,
      submitted_by_id: user.id,
    }, '-created_date', 20);
    const corrects = String(body.corrects_report_id || existing[0]?.id || '');
    const report = await base44.asServiceRole.entities.DailyReport.create({
      tenant_id: tenantId,
      report_id: `RPT-${crypto.randomUUID()}`,
      department,
      title,
      content,
      report_date: reportDate,
      priority: body.priority === 'urgent' ? 'urgent' : 'normal',
      metrics,
      submitted_by: user.full_name || user.email || 'Staff',
      submitted_by_id: user.id,
      status: 'submitted',
      ingestion_status: 'submitted',
      locked: true,
      file_url: fileUrls[0] || '',
      file_urls: fileUrls,
      ...(corrects && existing.length ? { corrects_report_id: corrects } : {}),
    });
    const purchases = Array.isArray(body.purchases) && dept.purchases_enabled ? body.purchases.slice(0, 50) : [];
    const storedPurchases = [];
    for (const line of purchases) {
      const item = String(line.item || '').trim();
      if (!item) continue;
      const stored = {
        tenant_id: tenantId,
        report_id: report.id,
        department,
        item,
        quantity: Number(line.quantity) || 0,
        unit_price: Number(line.unit_price) || 0,
        supplier: String(line.supplier || '').trim(),
        receipt_url: validUrl(line.receipt_url) ? line.receipt_url : '',
        line_date: reportDate,
      };
      await base44.asServiceRole.entities.OversightPurchaseLine.create(stored);
      storedPurchases.push(stored);
    }
    const history = await base44.asServiceRole.entities.DailyReport.filter({ tenant_id: tenantId, department }, '-created_date', 20);
    const fraud = analyzeReportFraud({
      report: { ...report, metrics, department, corrects_report_id: corrects && existing.length ? corrects : '' },
      history: history.filter((row) => row.tenant_id === tenantId && row.id !== report.id),
      purchases: storedPurchases,
    });
    await base44.asServiceRole.entities.DailyReport.update(report.id, { fraud_analysis: fraud });
    const managers = (await base44.asServiceRole.entities.User.filter({ tenant_id: tenantId }, '-created_date', 200))
      .filter((u) => ['super_admin', 'org_admin', 'company_admin', 'executive'].includes(u.raviqen_role || u.role) && u.account_status !== 'disabled');
    for (const manager of managers) {
      await base44.asServiceRole.entities.OversightNotification.create({
        tenant_id: tenantId,
        user_id: manager.id,
        report_id: report.id,
        department,
        title: `${dept.name || department}: ${title}`,
      });
    }
    await writeOversightAudit(base44, {
      tenantId,
      actor: user,
      action: 'report_submit',
      entityType: 'DailyReport',
      entityId: report.id,
      after: { department, report_date: reportDate, correction: Boolean(corrects && existing.length) },
      ip: req.headers.get('x-forwarded-for') || '',
    });
    const weekLines = await base44.asServiceRole.entities.OversightPurchaseLine.filter({ tenant_id: tenantId, department }, '-created_date', 200);
    return Response.json({
      id: report.id,
      department: report.department,
      title: report.title,
      status: 'submitted',
      report_date: reportDate,
      correction: Boolean(corrects && existing.length),
      weekly_purchases: weekLines.filter((line) => line.submitted_by_id === user.id || line.report_id === report.id).length
        ? {
            lines: weekLines.length,
            total: weekLines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unit_price || 0), 0),
          }
        : null,
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Unable to submit report.' }, { status: 500 });
  }
}
