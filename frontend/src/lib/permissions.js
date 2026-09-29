// RAVIQEN Role-Based Access Control (RBAC) + Scope
// ACCESS = ROLE + PERMISSION + SCOPE + DATA SENSITIVITY

import { hasAssignedDepartment, isOversightFeatureEnabled, isOversightManagerRole, isStaffAiChatEnabled, needsDepartmentAssignment } from "./oversight.js";

export const ROLES = {
  pending: { label: "Pending / Guest", color: "slate", description: "New signup — pending Super Admin role assignment" },
  super_admin: { label: "Super Admin", color: "red", description: "RAVIQEN/system ownership — global unrestricted access" },
  org_admin: { label: "Organisation Admin", color: "orange", description: "General Manager — full access within their organization" },
  executive: { label: "Executive", color: "amber", description: "CEO/CFO/Owner — high visibility" },
  manager: { label: "Manager", color: "green", description: "Manage assigned area — daily report review" },
  hr_personnel: { label: "HR Personnel", color: "violet", description: "HR workspace & background screening" },
  restaurant_manager: { label: "Restaurant Manager", color: "teal", description: "Restaurant operations & daily reporting" },
  operations: { label: "Operations", color: "blue", description: "Operations oversight & daily reporting" },
  front_desk: { label: "Front Desk", color: "cyan", description: "Front desk operations & daily reporting" },
  investigator: { label: "Investigator / Auditor", color: "green", description: "Investigate alerts" },
  standard_user: { label: "Standard User", color: "blue", description: "View assigned information" },
  read_only: { label: "Read Only", color: "slate", description: "View reports/dashboard only" },
  company_admin: { label: "Company Admin", color: "orange", description: "Workspace/tenant admin — full access within their organization" },
  member: { label: "Member", color: "blue", description: "Organization member — standard access within their workspace" },
  department_user: { label: "Department user", color: "teal", description: "Submits daily reports for one assigned department only" },
};

export const ALL_ROLES = Object.keys(ROLES);

// Legacy role aliases — backward compatibility for existing users
const ROLE_ALIASES = {
  admin: "org_admin",
  user: "pending",
};

// Default role is Pending — new signups have no access until a Super Admin assigns a role.
export const DEFAULT_ROLE = "pending";

export const normalizeRole = (role) => ROLE_ALIASES[role] || role || DEFAULT_ROLE;

// Resolve the effective RAVIQEN role from a user object — prefers raviqen_role, falls back to platform role
export const normalizeUserRole = (user) => {
  if (user?.raviqen_role && ROLES[user.raviqen_role]) return user.raviqen_role;
  const resolved = normalizeRole(user?.role);
  if (ROLES[resolved]) return resolved;
  return DEFAULT_ROLE;
};

// RBAC Navigation Permission Matrix
// Maps each route to the RAVIQEN roles allowed to access it.
// Super Admin & Org Admin have unrestricted access to ALL routes.
export const FULL_ACCESS_ROLES = ['super_admin', 'org_admin', 'company_admin', 'executive', 'manager'];
export const isFullAccessRole = (role) => FULL_ACCESS_ROLES.includes(normalizeRole(role));

export const NAV_PERMISSIONS = {
  "/oversight": ["super_admin", "org_admin", "company_admin", "executive"],
  "/raven": ["super_admin", "org_admin"],
  "/dashboard": ["super_admin", "org_admin", "executive", "manager", "investigator", "standard_user", "read_only", "pending"],
  "/alerts": ["super_admin", "org_admin", "executive", "manager", "investigator", "standard_user"],
  "/investigations": ["super_admin", "org_admin", "executive", "manager", "investigator"],
  "/case-management": ["super_admin", "org_admin", "executive", "manager", "hr_personnel", "investigator"],
  "/ingestion": ["super_admin", "org_admin", "executive", "manager", "restaurant_manager", "operations", "front_desk", "standard_user"],
  "/ingestion-screening": ["super_admin", "org_admin", "executive", "manager", "investigator"],
  "/ingestion-audit": ["super_admin", "org_admin", "investigator"],
  "/procurement-variance": ["super_admin", "org_admin", "executive", "manager", "investigator", "standard_user", "read_only"],
  "/hospitality-fraud-detection": ["super_admin", "org_admin", "executive", "manager", "investigator", "standard_user", "read_only"],
  "/analytics": ["super_admin", "org_admin", "executive", "manager", "read_only"],
  "/osint-scanner": ["super_admin", "org_admin", "executive", "manager", "investigator"],
  "/vendor-verification": ["super_admin", "org_admin", "executive", "manager", "restaurant_manager", "operations", "front_desk", "standard_user"],
  "/reports-exports": ["super_admin", "org_admin", "executive", "manager", "hr_personnel", "investigator", "standard_user", "read_only"],
  "/daily-reports": ["super_admin", "org_admin", "executive", "manager", "hr_personnel", "restaurant_manager", "operations", "front_desk", "standard_user", "read_only"],
  "/relief-calendar": ["super_admin", "org_admin", "executive", "manager", "hr_personnel", "restaurant_manager", "operations", "front_desk", "investigator", "standard_user", "read_only"],
  "/resource-calculator": ["super_admin", "org_admin", "executive", "manager", "hr_personnel", "restaurant_manager", "operations", "front_desk", "investigator", "standard_user", "read_only"],
  "/integrations": ["super_admin", "org_admin"],
  "/settings": ["super_admin", "org_admin"],
  "/team": ["super_admin"],
  "/admin/users": ["super_admin", "org_admin", "company_admin"],
  "/audit-log": ["super_admin", "org_admin", "investigator"],
  "/support": ["super_admin", "org_admin", "executive", "manager", "hr_personnel", "restaurant_manager", "operations", "front_desk", "investigator", "standard_user", "read_only"],
  "/ai-chatbox": ["super_admin", "org_admin", "executive", "manager", "hr_personnel", "restaurant_manager", "operations", "front_desk", "investigator", "standard_user", "read_only"],
  "/organizations": ["super_admin", "org_admin", "executive", "manager", "standard_user", "pending"],
};

// Admin-level roles (full access)
export const ADMIN_ROLES = ["super_admin", "org_admin", "company_admin"];

// Roles that can review daily reports
export const REVIEW_ROLES = ["super_admin", "org_admin", "executive", "manager"];

// HR-authorized roles
export const HR_ROLES = ["super_admin", "org_admin", "manager", "hr_personnel"];

// Departmental roles (daily report submitters)
export const DEPARTMENTAL_ROLES = ["restaurant_manager", "operations", "front_desk", "hr_personnel", "manager"];

// Roles that can edit (not read-only)
export const EDIT_ROLES = ALL_ROLES.filter((r) => r !== "read_only");

export const isHRRole = (role) => HR_ROLES.includes(normalizeRole(role));
export const canReviewReports = (role) => REVIEW_ROLES.includes(normalizeRole(role));

export const isAdminRole = (role) => ADMIN_ROLES.includes(normalizeRole(role));

// Credential management — password create/reset restricted to admin roles ONLY
export const canManageCredentials = (role) => ADMIN_ROLES.includes(normalizeRole(role));

export const canEdit = (role) => EDIT_ROLES.includes(normalizeRole(role));

export const canAccessRoute = (path, roleOrUser) => {
  const user = roleOrUser && typeof roleOrUser === "object" ? roleOrUser : null;
  const effectiveRole = user ? normalizeUserRole(user) : normalizeRole(roleOrUser);
  const pathNorm = String(path || "/").replace(/\/$/, "") || "/";
  const oversightPath = pathNorm.startsWith("/raven") ? pathNorm.replace(/^\/raven/, "/oversight") : pathNorm;

  if (oversightPath.startsWith("/oversight")) {
    if (user && !isOversightFeatureEnabled(user)) return false;
    if (oversightPath === "/oversight/awaiting-assignment") {
      return needsDepartmentAssignment(user, effectiveRole);
    }
    if (oversightPath === "/oversight/submit") {
      if (isOversightManagerRole(effectiveRole)) return true;
      return effectiveRole !== "pending" && hasAssignedDepartment(user);
    }
    return isOversightManagerRole(effectiveRole);
  }

  if (pathNorm === "/ai-chatbox" && !isFullAccessRole(effectiveRole) && !isStaffAiChatEnabled(user)) {
    return false;
  }

  if (isFullAccessRole(effectiveRole)) return true;
  return false;
};

export const ROLE_HOME_ROUTES = {
  super_admin: "/dashboard",
  org_admin: "/dashboard",
  executive: "/dashboard",
  manager: "/dashboard",
  hr_personnel: "/oversight/submit",
  restaurant_manager: "/oversight/submit",
  operations: "/oversight/submit",
  front_desk: "/oversight/submit",
  investigator: "/dashboard",
  standard_user: "/oversight/submit",
  read_only: "/oversight/submit",
  pending: "/oversight/awaiting-assignment",
  company_admin: "/dashboard",
  member: "/oversight/submit",
  department_user: "/oversight/submit",
};

export const getRoleHomeRoute = (user) => {
  const role = normalizeUserRole(user);
  if (needsDepartmentAssignment(user, role)) return "/oversight/awaiting-assignment";
  if (isOversightManagerRole(role)) return "/dashboard";
  if (isFullAccessRole(role)) return "/dashboard";
  return "/oversight/submit";
};

export const getRoleLabel = (role) => ROLES[normalizeRole(role)]?.label || "User";
export const getRoleColor = (role) => ROLES[normalizeRole(role)]?.color || "slate";