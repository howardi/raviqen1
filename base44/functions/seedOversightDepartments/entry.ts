import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { assertOversightManager, writeOversightAudit } from '../../shared/oversight.ts';

const DEFAULTS = [
  { slug: 'hr', name: 'HR', nav_label: 'HR Dashboard', sort_order: 10, cutoff_time: '18:00', purchases_enabled: false, form_schema: { fields: [{ key: 'attendance', label: 'Attendance', type: 'number' }, { key: 'leave', label: 'Leave', type: 'number' }, { key: 'incidents', label: 'Incidents', type: 'number' }, { key: 'notes', label: 'Notes', type: 'textarea' }] } },
  { slug: 'procurement', name: 'Storekeeper', nav_label: 'Storekeeper Dashboard', sort_order: 20, cutoff_time: '18:00', purchases_enabled: true, form_schema: { fields: [{ key: 'stock_received', label: 'Stock received', type: 'number' }, { key: 'stock_issued', label: 'Stock issued', type: 'number' }, { key: 'notes', label: 'Notes', type: 'textarea' }], purchases: true } },
  { slug: 'restaurant', name: 'Restaurant Manager', nav_label: 'Restaurant Dashboard', sort_order: 30, cutoff_time: '18:00', purchases_enabled: false, form_schema: { fields: [{ key: 'sales', label: 'Sales', type: 'number' }, { key: 'covers', label: 'Covers', type: 'number' }, { key: 'wastage', label: 'Wastage', type: 'number' }, { key: 'notes', label: 'Notes', type: 'textarea' }] } },
  { slug: 'finance', name: 'Accountant', nav_label: 'Accountant Dashboard', sort_order: 40, cutoff_time: '18:00', purchases_enabled: false, form_schema: { fields: [{ key: 'receipts', label: 'Receipts', type: 'number' }, { key: 'payments', label: 'Payments', type: 'number' }, { key: 'cash_position', label: 'Cash position', type: 'number' }, { key: 'notes', label: 'Notes', type: 'textarea' }] } },
  { slug: 'audit', name: 'Auditor', nav_label: 'Audit Dashboard', sort_order: 50, cutoff_time: '18:00', purchases_enabled: false, form_schema: { fields: [{ key: 'findings', label: 'Findings', type: 'number' }, { key: 'exceptions', label: 'Exceptions', type: 'number' }, { key: 'samples_reviewed', label: 'Samples reviewed', type: 'number' }, { key: 'notes', label: 'Notes', type: 'textarea' }] } },
  { slug: 'operations', name: 'Operations Manager', nav_label: 'Operations Dashboard', sort_order: 60, cutoff_time: '18:00', purchases_enabled: false, form_schema: { fields: [{ key: 'incidents', label: 'Incidents', type: 'number' }, { key: 'staffing_gaps', label: 'Staffing gaps', type: 'number' }, { key: 'completed_tasks', label: 'Completed tasks', type: 'number' }, { key: 'notes', label: 'Notes', type: 'textarea' }] } },
  { slug: 'front_desk', name: 'Front Desk', nav_label: 'Front Desk Dashboard', sort_order: 70, cutoff_time: '18:00', purchases_enabled: false, form_schema: { fields: [{ key: 'occupancy', label: 'Occupancy %', type: 'number' }, { key: 'check_ins', label: 'Check-ins', type: 'number' }, { key: 'check_outs', label: 'Check-outs', type: 'number' }, { key: 'revenue', label: 'Revenue', type: 'number' }, { key: 'notes', label: 'Notes', type: 'textarea' }] } },
  { slug: 'maintenance', name: 'Maintenance', nav_label: 'Maintenance Dashboard', sort_order: 80, cutoff_time: '18:00', purchases_enabled: false, form_schema: { fields: [{ key: 'faults_reported', label: 'Faults reported', type: 'number' }, { key: 'faults_fixed', label: 'Faults fixed', type: 'number' }, { key: 'pending_jobs', label: 'Pending jobs', type: 'number' }, { key: 'notes', label: 'Notes', type: 'textarea' }] } },
];

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const gate = assertOversightManager(user);
    if (gate.error) return Response.json({ error: gate.error }, { status: gate.status });
    const existing = await base44.asServiceRole.entities.OversightDepartment.filter({ tenant_id: gate.tenantId }, 'sort_order', 100);
    for (const row of existing) {
      if (row.slug === 'procurement' && row.nav_label !== 'Storekeeper Dashboard') {
        await base44.asServiceRole.entities.OversightDepartment.update(row.id, { name: 'Storekeeper', nav_label: 'Storekeeper Dashboard', purchases_enabled: true });
      }
    }
    const have = new Set(existing.map((d) => d.slug));
    const created = [];
    for (const dept of DEFAULTS) {
      if (have.has(dept.slug)) continue;
      created.push(await base44.asServiceRole.entities.OversightDepartment.create({ tenant_id: gate.tenantId, active: true, ...dept }));
    }
    const departments = await base44.asServiceRole.entities.OversightDepartment.filter({ tenant_id: gate.tenantId }, 'sort_order', 100);
    await writeOversightAudit(base44, { tenantId: gate.tenantId, actor: user, action: 'departments_seed', entityType: 'OversightDepartment', after: { created: created.length } });
    return Response.json({ departments, created: created.length });
  } catch (error) {
    return Response.json({ error: error.message || 'Unable to seed departments.' }, { status: 500 });
  }
}
