// Employee Data Ingestion & Profile Management
// Handles CSV/XLSX parsing, employee creation, and candidate-to-employee conversion

import { base44 } from "@/api/base44Client";
import { stampTenant } from "@/lib/tenantScope";

const REQUIRED_FIELDS = ["employee_id", "full_name", "department", "role_title", "date_of_joining", "employment_status"];

const FIELD_NORMALIZATION = {
  employee_id: ["employee_id", "emp_id", "id", "staff_id"],
  full_name: ["full_name", "name", "employee_name", "staff_name"],
  department: ["department", "dept"],
  role_title: ["role_title", "role", "position", "job_title", "title"],
  date_of_joining: ["date_of_joining", "join_date", "start_date", "doj"],
  employment_status: ["employment_status", "status", "emp_status"],
  national_id_ssn: ["national_id_ssn", "national_id", "ssn", "id_number"],
  tax_number: ["tax_number", "tin", "tax_id"],
  bank_account_details: ["bank_account_details", "bank_account", "account_number"],
  contact_phone: ["contact_phone", "phone", "mobile", "contact"],
  emergency_contact: ["emergency_contact", "emergency", "ec_phone"],
};

export function normalizeRow(row) {
  const normalized = {};
  for (const [target, sources] of Object.entries(FIELD_NORMALIZATION)) {
    for (const src of sources) {
      if (row[src] !== undefined && row[src] !== null && row[src] !== "") {
        normalized[target] = String(row[src]).trim();
        break;
      }
    }
  }
  // Normalize department
  if (normalized.department) {
    const d = normalized.department.toLowerCase();
    if (d.includes("restaurant") || d.includes("f&b") || d.includes("fnb")) normalized.department = "restaurant";
    else if (d.includes("operation")) normalized.department = "operations";
    else if (d.includes("front") || d.includes("desk") || d.includes("reception")) normalized.department = "front_desk";
    else if (d.includes("hr") || d.includes("human")) normalized.department = "hr";
    else if (d.includes("finance") || d.includes("account")) normalized.department = "finance";
    else normalized.department = "general";
  }
  // Normalize employment status
  if (normalized.employment_status) {
    const s = normalized.employment_status.toLowerCase();
    if (s.includes("active") || s.includes("employed")) normalized.employment_status = "active";
    else if (s.includes("leave") || s.includes("absent")) normalized.employment_status = "on_leave";
    else if (s.includes("suspend")) normalized.employment_status = "suspended";
    else if (s.includes("terminat") || s.includes("exit") || s.includes("former")) normalized.employment_status = "terminated";
    else normalized.employment_status = "active";
  }
  return normalized;
}

export function validateEmployeeRow(row) {
  const missing = REQUIRED_FIELDS.filter((f) => !row[f]);
  return { valid: missing.length === 0, missing };
}

export async function ingestEmployeeRows(rows, user) {
  const results = { created: 0, updated: 0, failed: 0, errors: [] };
  const toCreate = [];
  const toUpdate = [];

  for (let i = 0; i < rows.length; i++) {
    const normalized = normalizeRow(rows[i]);
    const validation = validateEmployeeRow(normalized);
    if (!validation.valid) {
      results.failed++;
      results.errors.push(`Row ${i + 2}: Missing fields — ${validation.missing.join(", ")}`);
      continue;
    }
    // Check if employee_id already exists
    try {
      const existing = await base44.entities.Employee.filter({ employee_id: normalized.employee_id }, "-created_date", 1);
      if (existing.length > 0) {
        toUpdate.push({ id: existing[0].id, ...normalized });
      } else {
        toCreate.push(normalized);
      }
    } catch (e) {
      toCreate.push(normalized);
    }
  }

  if (toCreate.length > 0) {
    try {
      const created = await base44.entities.Employee.bulkCreate(toCreate.map((r) => stampTenant(r, user)));
      results.created += toCreate.length;
    } catch (e) {
      results.failed += toCreate.length;
      results.errors.push(`Bulk create failed: ${e.message}`);
    }
  }

  for (const u of toUpdate) {
    try {
      const { id, ...data } = u;
      await base44.entities.Employee.update(id, data);
      results.updated++;
    } catch (e) {
      results.failed++;
      results.errors.push(`Update failed for ${u.employee_id}: ${e.message}`);
    }
  }

  return results;
}

export async function convertCandidateToEmployee(check, user) {
  const employeeId = `EMP-${Date.now().toString().slice(-6)}`;
  const employeeData = {
    employee_id: employeeId,
    full_name: check.candidate_name,
    department: check.department || "general",
    role_title: check.position_applied || "",
    date_of_joining: new Date().toISOString().split("T")[0],
    employment_status: "active",
    national_id_ssn: check.national_id || "",
    tax_number: check.tax_number || "",
    linked_background_check_id: check.id,
    risk_score: check.risk_score || 0,
    risk_flags: check.flags || [],
    profile_metadata: { converted_from_screening: true, screening_date: check.screening_date },
  };
  const employee = await base44.entities.Employee.create(stampTenant(employeeData, user));
  // Mark the background check as converted
  await base44.entities.BackgroundCheck.update(check.id, {
    status: "archived",
    profile_metadata: { converted_to_employee_id: employeeId },
  });
  return employee;
}