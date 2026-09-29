import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import {
  getPlanLimits,
  isFeatureAvailable,
  enforceUserLimit,
  enforceTransactionCap,
  PLAN_PRICES,
} from "../../shared/plans.ts";

// Returns the caller's organization plan, current usage, and whether a given
// action (invite user / ingest transactions / access feature) is allowed.
// The frontend calls this before user invites, data ingestion, and gated
// module access so limits and feature gates are enforced consistently.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { organization_id, feature, incoming_transactions } = body;
    if (!organization_id) {
      return Response.json({ error: 'Missing organization_id' }, { status: 400 });
    }

    const org = await base44.entities.Organization.get(organization_id);
    if (!org) return Response.json({ error: 'Organization not found' }, { status: 404 });

    const plan = org.subscription_plan || "starter";
    const limits = getPlanLimits(plan);

    const userCheck = await enforceUserLimit(base44, organization_id, plan);
    const txnCheck = await enforceTransactionCap(base44, plan, Number(incoming_transactions) || 0);
    const featureAllowed = feature ? isFeatureAvailable(plan, feature) : true;

    return Response.json({
      plan,
      price: PLAN_PRICES[plan],
      limits,
      usage: {
        users: userCheck.current,
        transactions_this_month: txnCheck.current,
      },
      allowed: {
        invite_user: userCheck.allowed,
        ingest_transactions: txnCheck.allowed,
        feature: featureAllowed,
      },
      feature_key: feature || null,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}