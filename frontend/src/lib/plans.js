// Single source of truth for the RAVIQEN 4-tier pricing model.
// Used by the pricing page, billing UI, and (mirrored) by the backend
// enforcement layer in base44/shared/plans.ts.

const STARTER_FEATURES = [
  "data_ingestion",
  "investigations",
  "alerts",
  "risk_rules",
  "reports_exports",
  "audit_log",
  "support",
  "settings",
  "daily_reports",
  "activity_stream",
  "centralised_information",
  "operational_visibility",
  "anomaly_detection",
];

const GROWTH_FEATURES = [
  ...STARTER_FEATURES,
  "autonomous_engine",
  "analytics",
  "ingestion_screening",
  "network_explorer",
  "case_management",
  "what_if_sandbox",
  "integrations",
  "relief_calendar",
  "resource_calculator",
  "multi_location_information",
  "operational_monitoring",
  "business_visibility",
  "advanced_reporting",
];

const PROFESSIONAL_FEATURES = [
  ...GROWTH_FEATURES,
  "entity_intelligence",
  "sanctions_screening",
  "vendor_verification",
  "regulatory_horizon",
  "collusion_detector",
  "osint_scanner",
  "fx_stress_test",
  "crypto_audit",
  "insider_threat",
  "hr_dashboard",
  "organisation_intelligence",
  "realtime_visibility",
  "procurement_monitoring",
  "financial_controls",
  "compliance_reporting",
];

// Enterprise = all features (null means "no gate / everything included")
export const PLAN_FEATURE_GATES = {
  starter: STARTER_FEATURES,
  growth: GROWTH_FEATURES,
  professional: PROFESSIONAL_FEATURES,
  enterprise: null,
};

export const PLAN_LIMITS = {
  starter: { max_users: 5, max_locations: 1, max_organizations: 1, max_transactions_per_month: 5000 },
  growth: { max_users: 25, max_locations: 5, max_organizations: 1, max_transactions_per_month: 50000 },
  professional: { max_users: 100, max_locations: 25, max_organizations: 1, max_transactions_per_month: 500000 },
  enterprise: { max_users: null, max_locations: null, max_organizations: null, max_transactions_per_month: null },
};

export const PLANS = [
  {
    id: "starter",
    name: "Starter",
    emoji: "🌱",
    price: 49,
    priceLabel: "$49",
    period: "/month",
    desc: "For small businesses getting started",
    intro: null,
    cta: { label: "Get Started", to: "/checkout?plan=starter" },
    highlight: false,
    features: [
      "Up to 5 users",
      "1 organisation",
      "1 location",
      "Up to 5,000 transactions/month",
      "Centralised business information",
      "Daily operational visibility",
      "Core AI risk & anomaly detection",
      "Risk dashboard",
      "Risk alerts",
      "AI-assisted investigations",
      "Manual data upload",
      "Streamlined basic reporting",
      "Core risk rules",
      "Audit trail",
      "Email support",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    emoji: "🚀",
    price: 199,
    priceLabel: "$199",
    period: "/month",
    desc: "For growing organisations",
    intro: "Everything in Starter, plus:",
    cta: { label: "Get Started", to: "/checkout?plan=growth" },
    highlight: true,
    features: [
      "Up to 25 users",
      "Up to 5 locations",
      "Up to 50,000 transactions/month",
      "Centralised multi-location information",
      "Continuous operational monitoring",
      "Advanced AI anomaly detection",
      "Advanced risk alerts",
      "Multiple data sources",
      "Enhanced business visibility",
      "Advanced reporting & analytics",
      "Custom alert thresholds",
      "Extended data history",
      "AI-powered investigations",
      "Basic integrations",
      "Priority email support",
    ],
  },
  {
    id: "professional",
    name: "Professional",
    emoji: "⭐",
    price: 499,
    priceLabel: "$499",
    period: "/month",
    desc: "For established organisations",
    intro: "Everything in Growth, plus:",
    cta: { label: "Get Started", to: "/checkout?plan=professional" },
    highlight: false,
    features: [
      "Up to 100 users",
      "Up to 25 locations",
      "Up to 500,000 transactions/month",
      "Automated data integrations",
      "Centralised organisation-wide intelligence",
      "Real-time operational visibility",
      "Entity intelligence",
      "Supplier intelligence",
      "Advanced procurement monitoring",
      "Advanced financial controls",
      "Custom risk rules",
      "Advanced analytics & insights",
      "API access",
      "Regulatory & compliance reporting",
      "Sanctions screening",
      "Priority support",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    emoji: "🏢",
    price: null,
    priceLabel: "Custom",
    period: "",
    desc: "For complex organisations",
    intro: "Everything in Professional, plus:",
    cta: { label: "Talk to Sales", href: "mailto:support@raviqen.com?subject=Enterprise%20Plan%20Inquiry" },
    highlight: false,
    features: [
      "Custom users & locations",
      "Custom transaction volume",
      "High-volume data processing",
      "Custom integrations",
      "Enterprise API",
      "Centralised enterprise-wide intelligence",
      "Organisation-wide operational visibility",
      "SSO / SAML",
      "Advanced role-based access control (RBAC)",
      "Custom risk models",
      "Advanced governance & controls",
      "Dedicated account manager",
      "Dedicated support",
      "SLA",
      "Implementation support",
      "Data migration",
      "Enterprise security requirements",
      "Optional private / on-premise deployment",
    ],
  },
];

export function getPlanById(id) {
  return PLANS.find((p) => p.id === id) || PLANS[0];
}

export function getPlanLimits(id) {
  return PLAN_LIMITS[id] || PLAN_LIMITS.starter;
}

export function isFeatureAvailable(planId, featureKey) {
  const gates = PLAN_FEATURE_GATES[planId];
  if (gates === null || gates === undefined) return true; // enterprise = all
  return gates.includes(featureKey);
}