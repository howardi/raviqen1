// RAVIQEN Phase 4 — Resolution & Ledger Integration
// Builds the strict JSON webhook payload for ERP/Ledger sync and the alert
// override payload consumed by the State Management & Alert Resolution Engine.

import { formatCurrency } from "@/lib/currencyUtils";

const SCORE_LABEL = { low: "Low", medium: "Medium", high: "High", critical: "Critical" };

// Build the ledger integration payload for a single processed screening result.
// Shape matches the RAVIQEN webhook contract (event_type: "transaction.scanned").
export function buildLedgerPayload(result) {
  if (!result) return null;
  const rec = result.normalized || {};
  const ctx = result.contextual || {};
  const ravigen = result.ravigen_rules || [];
  const threatRules = (result.anomaly?.flags || []).length
    ? []
    : [];

  // Triggered rules = RAVIQEN mandatory rules + advanced threat rule ids
  const triggered = [
    ...ravigen.map((r) => r.rule_id),
    ...(result.advanced_threats?.rules || []).map((r) => r.rule_id),
  ];
  const uniqueTriggered = [...new Set(triggered)].filter(Boolean);

  const cleared = result.verification_status === "valid";
  const screeningNotes = ctx.notes?.length ? ctx.notes.join("; ") : null;

  return {
    event_type: "transaction.scanned",
    document_id: rec.transaction_id || null,
    vendor_entity: rec.vendor || null,
    formatted_amount: formatCurrency(rec.amount, rec.currency || "USD"),
    risk_assessment: {
      final_score: SCORE_LABEL[result.risk_level] || "Low",
      triggered_rules: uniqueTriggered.length ? uniqueTriggered : "None - Baseline Normal",
      screening_notes: screeningNotes,
    },
    ledger_action: {
      command: cleared ? "update_record" : "quarantine_record",
      status: cleared ? "Validated" : "Pending_Investigation",
      clear_for_disbursement: cleared,
    },
  };
}