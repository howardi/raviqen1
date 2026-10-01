// Initial Super Admin login for the Command Center demo.
// A matching Base44 account is used when it exists. Otherwise the browser
// keeps a session so the portal can be opened for setup.
export const COMMAND_CENTER_ADMIN = {
  email: "admin@raviqen.com",
  password: "AdminPassword123!",
  role: "super_admin",
};

const STORAGE_KEY = "raviqen.commandCenterAdmin";

export function matchesCommandCenterAdmin(email, password) {
  return String(email || "").trim().toLowerCase() === COMMAND_CENTER_ADMIN.email
    && password === COMMAND_CENTER_ADMIN.password;
}

export function commandCenterAdminUser() {
  return {
    id: "command-center-admin",
    email: COMMAND_CENTER_ADMIN.email,
    full_name: "Raviqen Super Admin",
    role: "admin",
    raviqen_role: "super_admin",
    tenant_id: "raviqen-command-center",
    account_status: "active",
    department: "general",
    feature_flags: { raviqen_oversight: true, staff_ai_chatbox: false },
  };
}

export function saveCommandCenterSession() {
  sessionStorage.setItem(STORAGE_KEY, "1");
}

export function readCommandCenterSession() {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === "1" ? commandCenterAdminUser() : null;
  } catch {
    return null;
  }
}

export function clearCommandCenterSession() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode */
  }
}
