// RAVIQEN Autonomous Scanning & Investigation Engine
// Listens globally across all ingestion touchpoints (Data Ingestion Portal,
// manual uploads, API connectors, file drops, OCR scans). Instantly extracts
// metadata, enforces single-entry company profile creation, performs historical
// transaction comparison, generates real-time alerts, recalculates risk scores,
// and builds dynamic investigation cases with AI executive briefings.

import { base44 } from "@/api/base44Client";
import {
  normalizeTabularRecord,
  extractRecordsFromFile,
} from "@/lib/ingestionScreening";
import { formatCurrencyISO } from "@/lib/currencyUtils";
import {
  extractEntityFromTransaction,
  resolveEntity,
  createEntityProfile,
  aggregateTransactions,
  syncProfile,
  normalizeName,
} from "@/lib/entityIntelligence";
import { stampTenant } from "@/lib/tenantScope";
import { runRavigenRules, isPlaceholderValue } from "@/lib/ingestionScreening";
import { analyzeProcurementVariance, topProcurementRule, isProcurementRecord } from "@/lib/procurementVariance";
import { inspectProcurementRow } from "@/lib/procurementEvidence";
import { extractOperationalRecords, runHospitalityFraudDetection, persistFraudAlerts } from "@/lib/hospitalityFraudEngine";
import { withoutReplayedTransaction } from "@/lib/scanConsistency";

const REQUIRED_FIELDS = ["transaction_id", "vendor", "amount"];
const HIGH_VALUE_THRESHOLD = 50000;

// ─── 1. HISTORICAL COMPARATIVE ANALYSIS ─────────────────────────────────────
// Compares a new record against all historical transactions in the entity's
// profile to detect: bank account variance, pricing anomalies, duplicate /
// split-billing schemes, and velocity / frequency spikes.

export function compareWithHistory(record, historicalTxns, entityProfile) {
  const discrepancies = [];

  // 1a. Bank Account Variance
  if (record.bank_account && entityProfile?.bank_accounts?.length > 0) {
    const knownAccounts = entityProfile.bank_accounts.map((a) => a.account || a);
    if (!knownAccounts.includes(record.bank_account)) {
      discrepancies.push({
        type: "bank_account_variance",
        severity: record.amount > HIGH_VALUE_THRESHOLD ? "critical" : "high",
        title: "Bank Account Changed",
        detail: `Payment destination ${record.bank_account} differs from ${knownAccounts.length} historical account(s): ${knownAccounts.join(", ")}`,
        historical: knownAccounts.join(", "),
        current: record.bank_account,
        evidence_field: "bank_account",
        evidence_value: record.bank_account,
      });
    }
  }

  // 1b. Pricing & Amount Anomalies
  const amounts = historicalTxns.filter((t) => t.currency && t.currency === record.currency).map((t) => t.amount).filter((a) => typeof a === "number" && a > 0);
  if (amounts.length >= 3) {
    const avg = amounts.reduce((s, a) => s + a, 0) / amounts.length;
    const max = Math.max(...amounts);

    // Sudden price spike (3x+ above average)
    if (record.amount > avg * 3) {
      discrepancies.push({
        type: "price_spike",
        severity: record.amount > avg * 5 ? "critical" : "high",
        title: "Amount Spike",
        detail: `${record.currency || "USD"} ${record.amount?.toLocaleString()} is ${(record.amount / avg).toFixed(1)}x the historical average of ${Math.round(avg).toLocaleString()}`,
        historical: Math.round(avg).toString(),
        current: record.amount.toString(),
        evidence_field: "amount",
        evidence_value: `${record.currency || "USD"} ${record.amount?.toLocaleString()}`,
      });
    }

    // Exceeds historical max
    if (record.amount > max * 1.5 && historicalTxns.length >= 5) {
      discrepancies.push({
        type: "exceeds_historical_max",
        severity: "high",
        title: "Exceeds Historical Maximum",
        detail: `${record.amount?.toLocaleString()} is ${(record.amount / max).toFixed(1)}x the previous highest invoice of ${max.toLocaleString()}`,
        historical: max.toString(),
        current: record.amount.toString(),
        evidence_field: "amount",
        evidence_value: `${record.currency || "USD"} ${record.amount?.toLocaleString()}`,
      });
    }

    // Unnatural round total (fraud indicator for large amounts)
    if (record.amount > 10000 && record.amount % 10000 === 0) {
      discrepancies.push({
        type: "unnatural_total",
        severity: "medium",
        title: "Unnatural Round Total",
        detail: `Invoice total ${record.amount?.toLocaleString()} is a suspiciously round number (possible fabricated invoice)`,
        evidence_field: "amount",
        evidence_value: `${record.currency || "USD"} ${record.amount?.toLocaleString()}`,
      });
    }
  }

  // 1c. Line-Item & Duplicate Matching
  if (record.transaction_id) {
    const dup = historicalTxns.find(
      (t) => t.transaction_id && String(t.transaction_id).toLowerCase() === String(record.transaction_id).toLowerCase()
    );
    if (dup) {
      discrepancies.push({
        type: "duplicate_invoice",
        severity: "critical",
        title: "Duplicate Invoice Number",
        detail: `Invoice "${record.transaction_id}" already exists in historical records (dated ${dup.transaction_date || "unknown"})`,
        historical: dup.transaction_date || "",
        current: record.transaction_date || "",
        evidence_field: "transaction_id",
        evidence_value: record.transaction_id,
      });
    }
  }

  // Split-billing / smurfing detection (multiple invoices just under threshold)
  if (record.transaction_date && record.currency === "USD") {
    const recordDate = new Date(record.transaction_date);
    if (!isNaN(recordDate.getTime())) {
      const recentTxns = historicalTxns.filter((t) => {
        if (!t.transaction_date) return false;
        const diff = Math.abs(new Date(t.transaction_date) - recordDate) / 86400000;
        return diff <= 7;
      });
      const nearThreshold = recentTxns.filter((t) => t.amount > 40000 && t.amount < HIGH_VALUE_THRESHOLD);
      const currentNear = record.amount > 40000 && record.amount < HIGH_VALUE_THRESHOLD;
      if (nearThreshold.length + (currentNear ? 1 : 0) >= 3) {
        discrepancies.push({
          type: "split_billing",
          severity: "high",
          title: "Potential Split-Billing (Smurfing)",
          detail: `${nearThreshold.length + (currentNear ? 1 : 0)} invoices just under $50K threshold within 7 days — possible structuring to avoid detection`,
          evidence_field: "amount",
          evidence_value: `${record.currency || "USD"} ${record.amount?.toLocaleString()}`,
        });
      }
    }
  }

  // 1d. Velocity & Frequency Check
  if (record.transaction_date) {
    const recordDate = new Date(record.transaction_date);
    if (!isNaN(recordDate.getTime())) {
      // Same-day velocity
      const sameDay = historicalTxns.filter((t) => {
        if (!t.transaction_date) return false;
        const priorDate = new Date(t.transaction_date);
        return !isNaN(priorDate.getTime()) && priorDate.toISOString().slice(0, 10) === recordDate.toISOString().slice(0, 10);
      });
      if (sameDay.length >= 3) {
        discrepancies.push({
          type: "velocity_spike",
          severity: "high",
          title: "Abnormal Submission Velocity",
          detail: `${sameDay.length + 1} invoices dated ${recordDate.toISOString().slice(0, 10)}; review submission frequency`,
          evidence_field: "transaction_date",
          evidence_value: record.transaction_date,
        });
      }

      // Off-hours / weekend
      const hour = recordDate.getUTCHours();
      if (recordDate.getUTCDay() === 0 || recordDate.getUTCDay() === 6) {
        discrepancies.push({
          type: "weekend_submission",
          severity: "medium",
          title: "Weekend Submission",
          detail: `Transaction dated on a weekend (${recordDate.toISOString().slice(0, 10)}) — outside standard business days`,
          evidence_field: "transaction_date",
          evidence_value: record.transaction_date,
        });
      }
      if (/T\d{2}:\d{2}/.test(record.transaction_date) && (hour < 6 || hour >= 22)) {
        discrepancies.push({
          type: "off_hours",
          severity: "medium",
          title: "Off-Hours Submission",
          detail: `Transaction timestamped at ${hour}:00 UTC — outside the UTC review window (6:00–22:00)`,
          evidence_field: "transaction_date",
          evidence_value: record.transaction_date,
        });
      }
    }
  }

  // High-value threshold
  if (record.currency === "USD" && record.amount > HIGH_VALUE_THRESHOLD) {
    discrepancies.push({
      type: "high_value",
      severity: record.amount > 200000 ? "critical" : "high",
      title: "High-Value Transaction",
      detail: `${record.currency || "USD"} ${record.amount?.toLocaleString()} exceeds the $50,000 review threshold`,
      evidence_field: "amount",
      evidence_value: `${record.currency || "USD"} ${record.amount?.toLocaleString()}`,
    });
  }

  // RAVIQEN mandatory risk-briefing rules (RULE-BE-01 / HV-02). BS-03 (low/normal)
  // is intentionally excluded here so settled receipts don't spawn alerts — they
  // already classify as clean/low without discrepancies.
  for (const r of runRavigenRules(record)) {
    if (r.severity === "high" || r.severity === "critical") {
      discrepancies.push({ type: r.rule_id, severity: r.severity, title: r.title, detail: r.detail, mitigation: r.mitigation, evidence_field: r.evidence_field, evidence_value: r.evidence_value });
    }
  }

  // HARD PLATFORM-WIDE CONSTRAINT: a discrepancy/flag may only exist if it
  // references a real extracted source field + value. No evidence field, no
  // value, or a placeholder value (e.g. "Not Specified") → the flag is
  // dropped entirely, never displayed, never scored.
  return discrepancies.filter(
    (d) => d.evidence_field && !isPlaceholderValue(d.evidence_value)
  );
}

// ─── 2. THREAT LEVEL CATEGORIZATION ─────────────────────────────────────────

export function categorizeThreatLevel(discrepancies, record) {
  const sevScores = { low: 5, medium: 15, high: 30, critical: 50 };
  let score = discrepancies.reduce((s, d) => s + (sevScores[d.severity] || 10), 0);
  if (discrepancies.length && record.amount > HIGH_VALUE_THRESHOLD) score += 10;
  if (discrepancies.length && record.currency === "USD" && record.amount > 200000) score += 10;
  if (discrepancies.some((d) => d.severity === "critical")) score = Math.max(score, 75);
  else if (discrepancies.some((d) => d.severity === "high")) score = Math.max(score, 55);
  else if (discrepancies.some((d) => d.severity === "medium")) score = Math.max(score, 30);
  score = Math.min(score, 100);
  const level = score >= 75 ? "critical" : score >= 55 ? "high" : score >= 30 ? "medium" : "low";
  return { score, level };
}

// ─── 3. AI EXECUTIVE BRIEFING GENERATION ─────────────────────────────────────

const BRIEFING_SCHEMA = {
  type: "object",
  properties: {
    executive_summary: { type: "string", description: "2-3 sentence overview of the risk situation" },
    discrepancies: { type: "array", items: { type: "string" }, description: "Bullet list of detected issues" },
    cumulative_exposure: { type: "string", description: "Total risk exposure across all transactions with this entity" },
    network_links: { type: "string", description: "Any shared identifiers or links with other flagged entities" },
    recommended_steps: { type: "array", items: { type: "string" }, description: "3-5 immediate actions for compliance officers" },
  },
};

export async function generateExecutiveBriefing(record, entityProfile, discrepancies, historicalTxns, alertLevel) {
  const amountStr = formatCurrencyISO(record.amount, record.currency);
  const exposureStr = formatCurrencyISO(entityProfile.lifetime_exposure || 0, entityProfile.exposure_currency);
  const avgInvoiceStr = formatCurrencyISO(entityProfile.avg_invoice_amount || 0, entityProfile.exposure_currency || record.currency);
  const prompt = `You are the RAVIQEN Autonomous Investigation Engine. Generate a concise executive briefing for a flagged transaction.

ENTITY: ${entityProfile.legal_name}
TRANSACTION: ${record.transaction_id} | ${amountStr}
DATE: ${record.transaction_date || "N/A"}

DISCREPANCIES DETECTED:
${discrepancies.map((d) => `- ${d.title}: ${d.detail}`).join("\n")}

HISTORICAL CONTEXT:
- Total prior transactions: ${historicalTxns.length}
- Lifetime exposure: ${exposureStr}
- Average invoice: ${avgInvoiceStr}
- Current risk score: ${entityProfile.risk_score || 0}/100
- Active anomaly flags: ${(entityProfile.active_anomaly_flags || []).join(", ") || "None"}
- Shared identifiers: ${(entityProfile.shared_identifiers || []).map((s) => s.entity + " (" + s.type + ")").join(", ") || "None"}

THREAT LEVEL: ${alertLevel.toUpperCase()}

Strict evidence rules — READ CAREFULLY:
- This is a factual briefing, not a clearance decision. You have NO authority to clear, verify, whitelist, or approve this vendor/transaction, and no authority to recommend payment disbursement. Only a human compliance officer can do that.
- Do NOT state or imply the transaction has been "cleared", "verified", "approved", "whitelisted", or is "safe to pay" — this case is currently OPEN and unresolved.
- Restate ONLY the discrepancies listed above, using their exact detail text. Do not invent a vendor's industry, verification status, or "enterprise" standing — you have not been given any registry/KYB data confirming that.
- Recommended next steps must be human review/investigation actions only (e.g. "escalate to compliance", "request supporting documentation", "hold disbursement pending review") — never "proceed with payment" or similar.

Currency formatting (STRICT): Use the correct localized symbol for every monetary value — ₦ for NGN, $ for USD, £ for GBP, € for EUR. NEVER default to the '$' symbol unless the currency is explicitly USD. For Nigerian Naira, output either "₦30,000,000" or "30,000,000 NGN". NEVER mix a symbol with an ISO code (e.g., "$30,000,000 NGN" is prohibited).

Generate a structured executive briefing for compliance officers. Include:
1. EXECUTIVE SUMMARY: 2-3 sentence overview of the risk
2. DISCREPANCIES: Bullet list of detected issues
3. CUMULATIVE EXPOSURE: Total risk across all transactions with this entity
4. NETWORK LINKS: Any shared identifiers with other entities
5. RECOMMENDED NEXT STEPS: 3-5 immediate actions (e.g., "Freeze Payment Disbursement", "Request Bank Account Verification", "Escalate to Fraud Team")`;

  try {
    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      model: "gemini_3_flash",
      response_json_schema: BRIEFING_SCHEMA,
    });
    return result || null;
  } catch (e) {
    console.error("Briefing generation failed", e);
    return null;
  }
}

// ─── 4. CASE MANAGEMENT (auto-open or update investigation) ──────────────────

export async function createOrUpdateInvestigationCase(profile, record, discrepancies, threatLevel, user) {
  // Check for existing open investigation for this entity
  const existing = await base44.entities.Investigation.filter(
    { vendor: profile.legal_name, status: "open" },
    "-created_date",
    1
  );

  if (existing && existing.length > 0) {
    // Update existing case with new evidence
    const inv = existing[0];
    const newFlags = [...new Set([...(inv.cited_signals || []), ...discrepancies.map((d) => d.title)])];
    const newNotes = (inv.notes || "") + `\n\n--- Update ${new Date().toLocaleString()} ---\nNew transaction ${record.transaction_id} (${record.currency || "USD"} ${record.amount}) flagged: ${discrepancies.map((d) => d.title).join(", ")}`;
    await base44.entities.Investigation.update(inv.id, {
      cited_signals: newFlags,
      notes: newNotes,
      risk_level: threatLevel.level > (inv.risk_level || "low") ? threatLevel.level : inv.risk_level,
    });
    return { investigation: { ...inv, cited_signals: newFlags, notes: newNotes }, isNew: false };
  }

  // Create new investigation case
  const inv = await base44.entities.Investigation.create(stampTenant({
    title: `Autonomous Case: ${profile.legal_name} — ${discrepancies[0]?.title || "Anomaly Detected"}`,
    transaction_id: record.transaction_id,
    vendor: profile.legal_name,
    status: "open",
    outcome: "pending",
    risk_level: threatLevel.level,
    investigator: user?.email || "autonomous_engine",
    cited_signals: discrepancies.map((d) => d.title),
    notes: `Auto-generated by Autonomous Scanning Engine on ${new Date().toLocaleString()}.\n\nTriggering Transaction: ${record.transaction_id}\nAmount: ${record.currency || "USD"} ${record.amount?.toLocaleString()}\nThreat Level: ${threatLevel.level.toUpperCase()}\nRisk Score: ${threatLevel.score}/100\n\nDiscrepancies:\n${discrepancies.map((d) => `• ${d.title}: ${d.detail}`).join("\n")}`,
  }, user));
  // Link case file to entity profile
  if (profile.id) {
    await base44.entities.EntityProfile.update(profile.id, { case_file_ref: inv.id, status: "under_review" });
  }
  return { investigation: inv, isNew: true };
}

// ─── 5. MAIN ORCHESTRATOR ───────────────────────────────────────────────────
// Runs the full autonomous pipeline on a set of ingested records.

export async function runAutonomousScan(input) {
  const { records, source = "data_ingestion", filename = "", batchId = "", user, onProgress } = input;
  const startTime = Date.now();
  const scanId = `SCAN-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  // Create scan tracking record
  const scan = await base44.entities.AutonomousScan.create(stampTenant({
    scan_id: scanId,
    source,
    filename,
    batch_id: batchId,
    status: "scanning",
    total_records: records.length,
    triggered_by: user?.email || "system",
  }, user));

  const results = [];
  const allDiscrepancies = [];
  let alertsCount = 0, casesOpened = 0, casesUpdated = 0, newEntities = 0;
  const entityIds = new Set();

  // Load existing entity profiles for resolution
  let existingProfiles = [];
  try {
    existingProfiles = await base44.entities.EntityProfile.list("-created_date", 200);
  } catch (e) { console.error("Failed to load profiles", e); }

  for (let i = 0; i < records.length; i++) {
    const record = records[i];

    // 1. QUARANTINE CHECK — missing required fields
    const missing = REQUIRED_FIELDS.filter((f) => !record[f] || record[f] === "" || (f === "amount" && !Number.isFinite(Number(record[f]))));
    if (missing.length > 0) {
      await base44.entities.IngestionAuditFailure.create(stampTenant({
        document_id: crypto.randomUUID(), source_reference: record.transaction_id || "",
        entity_name: record.vendor || "Not specified", sector: record.sector || "Not specified",
        validated_amount: Number.isFinite(Number(record.amount)) ? Number(record.amount) : null,
        currency_iso: record.currency || "", risk_score: null, risk_level: "",
        verdict_summary: `Missing required fields: ${missing.join(", ")}. No risk score was assigned.`,
        batch_id: batchId, source_filename: filename, audit_status: "PENDING_REVIEW",
      }, user));
      results.push({ record, status: "quarantined", missing, discrepancies: [], riskScore: null, riskLevel: "not_scored" });
      if (onProgress) onProgress(i + 1, records.length);
      continue;
    }

    let createdTxn = null;
    try {
      // 2. ENTITY RESOLUTION — single-profile persistence
      const extracted = extractEntityFromTransaction(record, "vendor");
      // Source-provided bank details are unverified; don't establish a trusted account baseline.
      extracted.bank_accounts = [];
      if (record.tax_id) extracted.tax_id = record.tax_id;

      const { match, matchType } = resolveEntity(extracted, existingProfiles);
      let profile;
      let isNewEntity = false;
      if (match) {
        profile = match;
        // Do not promote an unverified payment destination into the trusted baseline.
      } else {
        profile = await createEntityProfile(extracted, user);
        existingProfiles.push(profile);
        isNewEntity = true;
        newEntities++;
      }
      entityIds.add(profile.id);

      // 3. FETCH HISTORICAL TRANSACTIONS
      const historicalTxns = withoutReplayedTransaction({ ...record, source_filename: filename }, await aggregateTransactions(profile));

      // 4. HISTORICAL COMPARATIVE ANALYSIS (uses original profile — before enrichment)
      const discrepancies = compareWithHistory(record, historicalTxns, profile);
      if (isProcurementRecord(record)) discrepancies.push(...inspectProcurementRow(record, records));

      // 4b. PROCUREMENT PRICING & MARKET VARIANCE (auto-detect procurement documents)
      let procurementVariance = null;
      if (isProcurementRecord(record)) {
        try {
          procurementVariance = await analyzeProcurementVariance(record, { skipMarket: true });
          if (procurementVariance) {
            const top = topProcurementRule(procurementVariance);
            if (top && !discrepancies.some((d) => d.type === top.flagged_rule)) {
              discrepancies.push({
                type: top.flagged_rule,
                severity: ["RULE-PG-03", "RULE-PG-04"].includes(top.flagged_rule) ? "critical" : "medium",
                title: top.status,
                detail: top.flagged_rule === "RULE-PG-04" ? top.arithmetic_finding : `[${top.flagged_rule}] ${top.item_description}: quoted ${top.invoice_unit_price} vs Nigerian market avg ${top.nigerian_market_avg} (${top.calculated_variance_percent}). ${procurementVariance.recommended_action}`,
                evidence_field: top.flagged_rule === "RULE-PG-04" ? "line_items.line_total" : "line_items.unit_price",
                evidence_value: top.flagged_rule === "RULE-PG-04" ? top.arithmetic_finding : `${top.item_description}: ${top.invoice_unit_price}; market ${top.nigerian_market_avg} (${top.market_source_url})`,
              });
            }
          }
        } catch (e) {
          console.error("Procurement variance analysis failed", e);
        }
      }

      // A changed payment destination is not trusted simply because it appeared in a scan.
      // Keep it out of the known-account baseline until separately verified by a human.

      // 5. THREAT LEVEL CATEGORIZATION
      const { score, level } = categorizeThreatLevel(discrepancies, record);

      // 6. CREATE TRANSACTION RECORD
      const txnStatus = level === "critical" ? "quarantined" : level === "high" || level === "medium" ? "flagged" : "clean";
      createdTxn = await base44.entities.Transaction.create(stampTenant({
        transaction_id: record.transaction_id,
        vendor: record.vendor,
        description: record.counterparty ? `Counterparty: ${record.counterparty}` : "",
        amount: record.amount,
        currency: record.currency || "",
        transaction_date: record.transaction_date,
        category: record.category || "",
        sector: record.sector || "",
        source_filename: filename,
        verdict_summary: discrepancies.map((d) => d.detail).filter(Boolean).join("; ") || "No evidenced risk flags recorded; pending human review.",
        audit_status: "PENDING_REVIEW",
        location: record.location || "",
        payment_method: record.payment_method || "",
        status: txnStatus,
        risk_score: score,
        risk_level: level,
        anomaly_flags: discrepancies.map((d) => d.title),
        flag_evidence: discrepancies.map((d) => ({ flag: d.title, rule_id: d.type, evidence_field: d.evidence_field, evidence_value: String(d.evidence_value), detail: d.detail })),
        procurement_variance: procurementVariance,
        batch_id: batchId,
      }, user));

      // 7. GENERATE ALERT if flagged
      let alertId = null;
      if (level !== "low" || discrepancies.length > 0) {
        const alertTitle = discrepancies[0]
          ? `[${level.toUpperCase()}] ${discrepancies[0].title}: ${record.vendor}`
          : `[${level.toUpperCase()}] Anomaly Detected: ${record.vendor}`;
        const alert = await base44.entities.Alert.create(stampTenant({
          title: alertTitle,
          transaction_id: record.transaction_id,
          vendor: record.vendor,
          amount: record.amount,
          currency: record.currency || "",
          risk_level: level,
          risk_score: score,
          description: discrepancies.map((d) => `${d.title}: ${d.detail}`).join("; ") || `Automated scan flagged this transaction with score ${score}/100`,
          flag_reasons: discrepancies.map((d) => d.title),
          flag_evidence: discrepancies.map((d) => ({ flag: d.title, rule_id: d.type, evidence_field: d.evidence_field, evidence_value: String(d.evidence_value), detail: d.detail })),
          status: "open",
          category: "autonomous_scan",
        }, user));
        alertId = alert.id;
        alertsCount++;
      }

      // 8. RECALCULATE ENTITY PROFILE RISK SCORE
      await syncProfile(profile, existingProfiles, user);

      // 9. AUTO-OPEN OR UPDATE INVESTIGATION CASE (high/critical only)
      let caseId = null;
      let caseIsNew = false;
      if (level === "high" || level === "critical") {
        const caseResult = await createOrUpdateInvestigationCase(profile, record, discrepancies, { score, level }, user);
        caseId = caseResult.investigation?.id;
        caseIsNew = caseResult.isNew;
        if (caseIsNew) casesOpened++; else casesUpdated++;

        // The saved case explanation is assembled only from source-backed findings.
        // A fresh generative briefing could change between identical scans.
        if (caseId) {
          const evidenceSummary = discrepancies.map((d) => `${d.title}: ${d.detail}`).join("\n");
          await base44.entities.Investigation.update(caseId, {
            ai_explanation: `${record.vendor} / ${record.transaction_id} requires human review (${level} risk). ${discrepancies.map((d) => d.detail).join(' ')}`,
            cited_signals: discrepancies.map((d) => d.title),
            recommended_actions: [{ action: "Review the cited source fields and supporting documents before making a payment or clearance decision." }],
            evidence_summary: evidenceSummary,
          });
        }
      }

      results.push({
        record,
        status: txnStatus,
        entityId: profile.id,
        entityName: profile.legal_name,
        isNewEntity,
        matchType: matchType,
        discrepancies,
        riskScore: score,
        riskLevel: level,
        alertId,
        caseId,
        caseIsNew,
        hasBriefing: level === "high" || level === "critical",
      });

      allDiscrepancies.push(...discrepancies.map((d) => ({ ...d, vendor: record.vendor, transaction_id: record.transaction_id })));
    } catch (e) {
      console.error("Record processing error", e);
      if (createdTxn) {
        await base44.entities.Transaction.update(createdTxn.id, { verdict_summary: `Processing incomplete: ${e.message}. Review the recorded risk assessment.` });
      } else {
        await base44.entities.IngestionAuditFailure.create(stampTenant({
          document_id: crypto.randomUUID(), source_reference: record.transaction_id || "",
          entity_name: record.vendor || "Not specified", sector: record.sector || "Not specified",
          validated_amount: Number.isFinite(Number(record.amount)) ? Number(record.amount) : null,
          currency_iso: record.currency || "", risk_score: null, risk_level: "",
          verdict_summary: `Processing failed: ${e.message}. No risk score was assigned.`,
          batch_id: batchId, source_filename: filename, audit_status: "PENDING_REVIEW",
        }, user));
      }
      results.push({ record, status: "quarantined", error: e.message, discrepancies: [], riskScore: null, riskLevel: "not_scored" });
    }

    if (onProgress) onProgress(i + 1, records.length);
  }

  // Update scan record with final results
  const duration = Date.now() - startTime;
  const quarantined = results.filter((r) => r.status === "quarantined").length;
  const flagged = results.filter((r) => r.status === "flagged").length;
  const clean = results.filter((r) => r.status === "clean").length;
  const invalid = results.filter((r) => r.missing?.length || r.error).length;

  await base44.entities.AutonomousScan.update(scan.id, {
    status: invalid === records.length && records.length > 0 ? "failed" : "completed",
    quarantined_records: quarantined,
    flagged_records: flagged,
    clean_records: clean,
    entities_resolved: entityIds.size,
    new_entities: newEntities,
    alerts_generated: alertsCount,
    cases_opened: casesOpened,
    cases_updated: casesUpdated,
    discrepancies: allDiscrepancies,
    scan_results: results.map((r) => ({
      transaction_id: r.record?.transaction_id,
      vendor: r.record?.vendor,
      amount: r.record?.amount,
      status: r.status,
      risk_score: r.riskScore,
      risk_level: r.riskLevel,
      discrepancies: r.discrepancies,
      entity_id: r.entityId,
      entity_name: r.entityName,
      is_new_entity: r.isNewEntity,
      alert_id: r.alertId,
      case_id: r.caseId,
      has_briefing: r.hasBriefing,
    })),
    duration_ms: duration,
  });

  return {
    scanId,
    scan,
    results,
    summary: {
      total: records.length,
      invalid,
      quarantined,
      flagged,
      clean,
      alerts: alertsCount,
      casesOpened,
      casesUpdated,
      newEntities,
      entitiesResolved: entityIds.size,
      duration,
    },
  };
}

// ─── 6. CONVENIENCE: Process an uploaded file end-to-end ─────────────────────
// Used by DataIngestion.jsx and any file-drop touchpoint.

export async function processIngestedFile(file, fileUrl, source, batchId, user, onProgress) {
  // Extract records from file (handles CSV, Excel, PDF, Word, Images)
  const normalizedRecords = await extractRecordsFromFile(fileUrl, file);
  const records = normalizedRecords.map((nr) => nr.record).filter(Boolean);
  const result = await runAutonomousScan({ records, source, filename: file?.name || "", batchId, user, onProgress });
  // Run operational rules on original columns, not normalized transactions.
  if (/\.(csv|tsv|txt|xlsx|xls|pdf)$/i.test(file?.name || "")) {
    try {
      const operationalRows = await extractOperationalRecords(fileUrl, file);
      const { alerts, errors } = runHospitalityFraudDetection(operationalRows);
      if (errors.length) throw new Error(errors.map((e) => e.message).join("; "));
      result.summary.operationalAlerts = await persistFraudAlerts(alerts, user, file?.name);
    } catch (e) {
      result.summary.operationalError = e.message;
      console.error("Operational fraud scan incomplete", e);
    }
  }
  return result;
}