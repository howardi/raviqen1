export const OVERSIGHT_HERO =
  "Manage your daily operations, centralise information, streamline reporting and gain better visibility into your business activities.";

export const OVERSIGHT_MANAGER_ROLES = ["super_admin", "org_admin", "company_admin", "executive"];

export const DEFAULT_OVERSIGHT_DEPARTMENTS = [
  { slug: "hr", name: "HR", nav_label: "HR Dashboard", sort_order: 10, cutoff_time: "18:00", purchases: false },
  { slug: "procurement", name: "Storekeeper", nav_label: "Storekeeper Dashboard", sort_order: 20, cutoff_time: "18:00", purchases: true },
  { slug: "restaurant", name: "Restaurant Manager", nav_label: "Restaurant Dashboard", sort_order: 30, cutoff_time: "18:00", purchases: false },
  { slug: "finance", name: "Accountant", nav_label: "Accountant Dashboard", sort_order: 40, cutoff_time: "18:00", purchases: false },
  { slug: "audit", name: "Auditor", nav_label: "Audit Dashboard", sort_order: 50, cutoff_time: "18:00", purchases: false },
  { slug: "operations", name: "Operations Manager", nav_label: "Operations Dashboard", sort_order: 60, cutoff_time: "18:00", purchases: false },
  { slug: "front_desk", name: "Front Desk", nav_label: "Front Desk Dashboard", sort_order: 70, cutoff_time: "18:00", purchases: false },
  { slug: "maintenance", name: "Maintenance", nav_label: "Maintenance Dashboard", sort_order: 80, cutoff_time: "18:00", purchases: false },
];

const notesField = { key: "notes", label: "Notes", type: "textarea", required: false };

export const DEFAULT_FORM_SCHEMAS = {
  front_desk: { fields: [
    { key: "occupancy", label: "Occupancy %", type: "number" },
    { key: "check_ins", label: "Check-ins", type: "number" },
    { key: "check_outs", label: "Check-outs", type: "number" },
    { key: "revenue", label: "Revenue", type: "number" },
    notesField,
  ] },
  restaurant: { fields: [
    { key: "sales", label: "Sales", type: "number" },
    { key: "covers", label: "Covers", type: "number" },
    { key: "wastage", label: "Wastage", type: "number" },
    notesField,
  ] },
  maintenance: { fields: [
    { key: "faults_reported", label: "Faults reported", type: "number" },
    { key: "faults_fixed", label: "Faults fixed", type: "number" },
    { key: "pending_jobs", label: "Pending jobs", type: "number" },
    notesField,
  ] },
  hr: { fields: [
    { key: "attendance", label: "Attendance", type: "number" },
    { key: "leave", label: "Leave", type: "number" },
    { key: "incidents", label: "Incidents", type: "number" },
    notesField,
  ] },
  finance: { fields: [
    { key: "receipts", label: "Receipts", type: "number" },
    { key: "payments", label: "Payments", type: "number" },
    { key: "cash_position", label: "Cash position", type: "number" },
    notesField,
  ] },
  audit: { fields: [
    { key: "findings", label: "Findings", type: "number" },
    { key: "exceptions", label: "Exceptions", type: "number" },
    { key: "samples_reviewed", label: "Samples reviewed", type: "number" },
    notesField,
  ] },
  operations: { fields: [
    { key: "incidents", label: "Incidents", type: "number" },
    { key: "staffing_gaps", label: "Staffing gaps", type: "number" },
    { key: "completed_tasks", label: "Completed tasks", type: "number" },
    notesField,
  ] },
  procurement: { fields: [
    { key: "stock_received", label: "Stock received", type: "number" },
    { key: "stock_issued", label: "Stock issued", type: "number" },
    notesField,
  ], purchases: true },
};

export function formSchemaFor(slug, storedSchema) {
  if (storedSchema?.fields?.length) return storedSchema;
  return DEFAULT_FORM_SCHEMAS[slug] || { fields: [notesField] };
}

export function isOversightManagerRole(role) {
  return OVERSIGHT_MANAGER_ROLES.includes(role);
}

export function hasAssignedDepartment(user) {
  const department = user?.department;
  return Boolean(department && department !== "general");
}

export function needsDepartmentAssignment(user, role) {
  if (isOversightManagerRole(role)) return false;
  if (role === "pending") return true;
  return !hasAssignedDepartment(user);
}

export function isOversightFeatureEnabled(user) {
  const flags = user?.feature_flags;
  if (flags && Object.prototype.hasOwnProperty.call(flags, "raviqen_oversight")) {
    return flags.raviqen_oversight !== false;
  }
  return true;
}

export function isStaffAiChatEnabled(user) {
  return user?.feature_flags?.staff_ai_chatbox === true;
}

export function sortOversightDepartments(rows) {
  return [...rows].filter((d) => d.active !== false).sort((a, b) => {
    const order = (a.sort_order ?? 999) - (b.sort_order ?? 999);
    if (order !== 0) return order;
    return String(a.nav_label || a.name || "").localeCompare(String(b.nav_label || b.name || ""));
  });
}

export function inboxStatus({ latest, cutoffTime, now = new Date() }) {
  if (latest) return "Submitted";
  const [hours, minutes] = String(cutoffTime || "18:00").split(":").map(Number);
  const cutoff = new Date(now);
  cutoff.setHours(Number.isFinite(hours) ? hours : 18, Number.isFinite(minutes) ? minutes : 0, 0, 0);
  return now >= cutoff ? "Overdue" : "Pending";
}

export function weeklyPurchaseSummary(lines, endDate = new Date()) {
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  start.setHours(0, 0, 0, 0);
  const inWeek = lines.filter((line) => {
    const day = new Date(line.line_date || line.created_date);
    return day >= start && day <= end;
  });
  const total = inWeek.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unit_price || 0), 0);
  return {
    start: start.toLocaleDateString("en-CA"),
    end: end.toLocaleDateString("en-CA"),
    lines: inWeek.length,
    total,
  };
}

export function tenantScoped(records, tenantId) {
  if (!tenantId) return [];
  return (records || []).filter((row) => row.tenant_id === tenantId);
}

export const ALLOWED_UPLOAD_TYPES = [
  "image/jpeg", "image/png", "image/webp", "application/pdf",
  "text/csv", "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
