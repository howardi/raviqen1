// Backend enforcement layer for the RAVIQEN 4-tier pricing model.
// Mirrors src/lib/plans.js so frontend display and server-side limits stay
// in sync. Imported by backend functions that need to enforce user limits,
// transaction caps, and feature gates.

export interface PlanLimits {
  max_users: number | null;
  max_locations: number | null;
  max_organizations: number | null;
  max_transactions_per_month: number | null;
}

export const PLAN_LIMITS: Record<string, PlanLimits> = {
  starter: { max_users: 5, max_locations: 1, max_organizations: 1, max_transactions_per_month: 5000 },
  growth: { max_users: 25, max_locations: 5, max_organizations: 1, max_transactions_per_month: 50000 },
  professional: { max_users: 100, max_locations: 25, max_organizations: 1, max_transactions_per_month: 500000 },
  enterprise: { max_users: null, max_locations: null, max_organizations: null, max_transactions_per_month: null },
};

export const PLAN_PRICES: Record<string, number | null> = {
  starter: 49,
  growth: 199,
  professional: 499,
  enterprise: null,
};

const STARTER_FEATURES = [
  "data_ingestion", "investigations", "alerts", "risk_rules", "reports_exports",
  "audit_log", "support", "settings", "daily_reports", "activity_stream",
  "centralised_information", "operational_visibility", "anomaly_detection",
];
const GROWTH_FEATURES = [
  ...STARTER_FEATURES, "autonomous_engine", "analytics", "ingestion_screening",
  "network_explorer", "case_management", "what_if_sandbox", "integrations",
  "relief_calendar", "resource_calculator",
  "multi_location_information", "operational_monitoring", "business_visibility", "advanced_reporting",
];
const PROFESSIONAL_FEATURES = [
  ...GROWTH_FEATURES, "entity_intelligence", "sanctions_screening", "vendor_verification",
  "regulatory_horizon", "collusion_detector", "osint_scanner", "fx_stress_test",
  "crypto_audit", "insider_threat", "hr_dashboard",
  "organisation_intelligence", "realtime_visibility", "procurement_monitoring",
  "financial_controls", "compliance_reporting",
];

export const PLAN_FEATURE_GATES: Record<string, string[] | null> = {
  starter: STARTER_FEATURES,
  growth: GROWTH_FEATURES,
  professional: PROFESSIONAL_FEATURES,
  enterprise: null, // null = all features unlocked
};

export function getPlanLimits(plan: string): PlanLimits {
  return PLAN_LIMITS[plan] || PLAN_LIMITS.starter;
}

export function isFeatureAvailable(plan: string, featureKey: string): boolean {
  const gates = PLAN_FEATURE_GATES[plan];
  if (gates === null || gates === undefined) return true;
  return gates.includes(featureKey);
}

// Count active+invited members for an organization (seats occupied).
export async function countOrgMembers(base44: any, organization_id: string): Promise<number> {
  const members = await base44.entities.OrganizationMember.filter({ organization_id });
  return (members || []).filter((m: any) => m.status !== "removed").length;
}

// Count transactions created this month for the caller's tenant (RLS-scoped).
export async function countMonthlyTransactions(base44: any): Promise<number> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const txns = await base44.entities.Transaction.list("-created_date", 10000);
  return (txns || []).filter((t: any) => {
    const d = t.created_date ? new Date(t.created_date) : null;
    return d ? d >= monthStart : false;
  }).length;
}

export interface LimitCheckResult {
  allowed: boolean;
  current: number;
  max: number | null;
}

// Enforce the user-seat limit before inviting a new member.
export async function enforceUserLimit(
  base44: any,
  organization_id: string,
  plan: string
): Promise<LimitCheckResult> {
  const limits = getPlanLimits(plan);
  const current = await countOrgMembers(base44, organization_id);
  if (limits.max_users === null) return { allowed: true, current, max: null };
  return { allowed: current < limits.max_users, current, max: limits.max_users };
}

// Enforce the monthly transaction cap before ingesting new records.
export async function enforceTransactionCap(
  base44: any,
  plan: string,
  incomingCount = 0
): Promise<LimitCheckResult> {
  const limits = getPlanLimits(plan);
  const current = await countMonthlyTransactions(base44);
  if (limits.max_transactions_per_month === null) return { allowed: true, current, max: null };
  return {
    allowed: current + incomingCount <= limits.max_transactions_per_month,
    current,
    max: limits.max_transactions_per_month,
  };
}