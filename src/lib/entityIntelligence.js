// RAVIQEN Entity Intelligence & Continuous Investigation Module
// Persistent company profiles, transaction aggregation, behavioral baselines,
// dynamic risk scoring, relationship mapping, and automated case file generation.

import { base44 } from "@/api/base44Client";
import { stampTenant } from "@/lib/tenantScope";
import { convertAmount, fetchFxRates } from "@/lib/currencyUtils";

// ─── Helpers ────────────────────────────────────────────────────────────────

export function normalizeName(name) {
  return (name || "").toLowerCase().trim().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ");
}

function jaccardSimilarity(a, b) {
  const setA = new Set(normalizeName(a).split(" ").filter((w) => w.length > 2));
  const setB = new Set(normalizeName(b).split(" ").filter((w) => w.length > 2));
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  setA.forEach((w) => { if (setB.has(w)) intersection++; });
  return intersection / (setA.size + setB.size - intersection);
}

function extractCounterparty(txn) {
  if (txn.counterparty) return txn.counterparty;
  if (txn.description && txn.description.startsWith("Counterparty: ")) {
    return txn.description.replace("Counterparty: ", "");
  }
  return "";
}

// ─── 1. ENTITY EXTRACTION ────────────────────────────────────────────────────

export function extractEntityFromTransaction(txn, role = "vendor") {
  const name = role === "vendor" ? txn.vendor : extractCounterparty(txn);
  return {
    legal_name: name || "",
    tax_id: txn.tax_id || "",
    bank_accounts: txn.bank_account ? [{ account: txn.bank_account, first_seen: txn.transaction_date }] : [],
    address: txn.location || "",
    country: txn.location || "",
    entity_type: role,
  };
}

// ─── ENTITY RESOLUTION & DEDUPLICATION ──────────────────────────────────────

export function resolveEntity(extracted, existingProfiles) {
  const normName = normalizeName(extracted.legal_name);
  if (!normName) return { match: null, matchType: "new_entity", confidence: 0 };

  // Exact name match
  for (const p of existingProfiles) {
    if (normalizeName(p.legal_name) === normName) {
      return { match: p, matchType: "exact_name", confidence: 1.0 };
    }
  }
  // Tax ID match
  if (extracted.tax_id) {
    for (const p of existingProfiles) {
      if (p.tax_id && p.tax_id.toLowerCase() === extracted.tax_id.toLowerCase()) {
        return { match: p, matchType: "tax_id", confidence: 0.95 };
      }
    }
  }
  // Bank account match
  if (extracted.bank_accounts?.length > 0) {
    for (const p of existingProfiles) {
      const pAccounts = (p.bank_accounts || []).map((a) => a.account || a);
      for (const ba of extracted.bank_accounts) {
        if (pAccounts.includes(ba.account)) {
          return { match: p, matchType: "bank_account", confidence: 0.9 };
        }
      }
    }
  }
  // Fuzzy name match
  let bestMatch = null;
  let bestScore = 0;
  for (const p of existingProfiles) {
    const score = jaccardSimilarity(extracted.legal_name, p.legal_name);
    if (score > bestScore && score > 0.85) {
      bestScore = score;
      bestMatch = p;
    }
  }
  if (bestMatch) return { match: bestMatch, matchType: "fuzzy_name", confidence: bestScore };

  return { match: null, matchType: "new_entity", confidence: 0 };
}

// ─── CREATE ENTITY PROFILE ───────────────────────────────────────────────────

export async function createEntityProfile(extracted, user, options = {}) {
  const now = new Date().toISOString();
  const profile = {
    profile_id: `ENT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    legal_name: extracted.legal_name,
    trading_name: extracted.trading_name || extracted.legal_name,
    entity_type: extracted.entity_type || "vendor",
    tax_id: extracted.tax_id || "",
    registration_number: extracted.registration_number || "",
    bank_accounts: extracted.bank_accounts || [],
    address: extracted.address || "",
    contact_email: extracted.contact_email || "",
    contact_phone: extracted.contact_phone || "",
    country: extracted.country || "",
    industry: extracted.industry || "",
    baseline_risk_tag: options.baseline_risk_tag || "low_risk",
    total_invoices: 0,
    lifetime_exposure: 0,
    exposure_currency: "USD",
    avg_invoice_amount: 0,
    payment_frequency_days: 0,
    currency_distribution: [],
    standard_hours: [],
    typical_categories: [],
    risk_score: 0,
    risk_level: "low",
    risk_trend: [],
    active_anomaly_flags: [],
    screening_status: "pending",
    sanctions_check: "not_checked",
    pep_check: "not_checked",
    linked_counterparties: [],
    shared_identifiers: [],
    collusion_probability: 0,
    case_file_ref: "",
    workflow_recommendations: [],
    status: "active",
    last_screened: null,
    first_seen: now.split("T")[0],
    last_activity: null,
  };
  return await base44.entities.EntityProfile.create(stampTenant(profile, user));
}

// ─── 2. TRANSACTION AGGREGATION & ENTITY LEDGER ──────────────────────────────

export async function aggregateTransactions(profile) {
  const allTxns = await base44.entities.Transaction.list("-created_date", 500);
  const normName = normalizeName(profile.legal_name);
  return allTxns.filter((t) => normalizeName(t.vendor) === normName);
}

export function computeBaselineMetrics(transactions, rates = null) {
  if (!transactions || transactions.length === 0) {
    return { total_invoices: 0, lifetime_exposure: 0, avg_invoice_amount: 0, payment_frequency_days: 0, currency_distribution: [], standard_hours: [], typical_categories: [] };
  }

  const total = transactions.length;
  // Sum in a single base currency (USD) so a multi-currency vendor ledger never
  // produces a meaningless mixed sum. Falls back to raw sum without rates.
  const totalAmount = transactions.reduce(
    (s, t) => s + (rates ? convertAmount(Number(t.amount) || 0, t.currency || "USD", "USD", rates) : (Number(t.amount) || 0)),
    0
  );
  const avg = totalAmount / total;

  const currencyMap = {};
  transactions.forEach((t) => { const c = t.currency || "USD"; currencyMap[c] = (currencyMap[c] || 0) + 1; });
  const currency_distribution = Object.entries(currencyMap).map(([currency, count]) => ({ currency, count }));

  const hourMap = {};
  transactions.forEach((t) => {
    if (t.transaction_date) { const d = new Date(t.transaction_date); if (!isNaN(d.getTime())) { const h = d.getHours(); hourMap[h] = (hourMap[h] || 0) + 1; } }
  });
  const standard_hours = Object.entries(hourMap).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([h]) => `${h}:00`);

  const catMap = {};
  transactions.forEach((t) => { if (t.category) catMap[t.category] = (catMap[t.category] || 0) + 1; });
  const typical_categories = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([cat]) => cat);

  let frequency = 0;
  if (transactions.length > 1) {
    const dates = transactions.map((t) => (t.transaction_date ? new Date(t.transaction_date).getTime() : null)).filter((d) => d && !isNaN(d)).sort((a, b) => a - b);
    if (dates.length > 1) {
      const diffs = [];
      for (let i = 1; i < dates.length; i++) diffs.push((dates[i] - dates[i - 1]) / 86400000);
      frequency = Math.round(diffs.reduce((s, d) => s + d, 0) / diffs.length);
    }
  }

  return { total_invoices: total, lifetime_exposure: totalAmount, avg_invoice_amount: Math.round(avg), payment_frequency_days: frequency, currency_distribution, standard_hours, typical_categories };
}

// ─── 3. DYNAMIC RISK SCORING ─────────────────────────────────────────────────

export function detectAnomalies(transactions, baseline) {
  const flags = [];
  if (!transactions.length || !baseline.avg_invoice_amount) return flags;

  const recent = transactions[0];

  // 5x invoice spike
  if (recent.currency === "USD" && recent.amount > baseline.avg_invoice_amount * 5) {
    flags.push(`Invoice spike: ${recent.amount?.toLocaleString()} vs avg ${baseline.avg_invoice_amount.toLocaleString()} (5x+)`);
  }
  // Off-hours / weekend
  if (recent.transaction_date) {
    const d = new Date(recent.transaction_date);
    if (!isNaN(d.getTime())) {
      const h = d.getHours();
      const day = d.getDay();
      if (/T\d{2}:\d{2}/.test(recent.transaction_date) && (h < 6 || h >= 22)) flags.push("Off-hours transaction");
      if (d.getUTCDay() === 0 || d.getUTCDay() === 6) flags.push("Weekend transaction");
    }
  }
  // New category
  if (recent.category && baseline.typical_categories.length > 0 && !baseline.typical_categories.includes(recent.category)) {
    flags.push(`New category: ${recent.category}`);
  }
  // Frequency spike (3x faster than baseline)
  if (baseline.payment_frequency_days > 0 && transactions.length >= 2) {
    const dates = transactions.slice(0, 2).map((t) => new Date(t.transaction_date).getTime()).sort((a, b) => b - a);
    const recentDiff = (dates[0] - dates[1]) / 86400000;
    if (recentDiff < baseline.payment_frequency_days / 3) flags.push("Frequency spike: 3x faster than baseline");
  }
  // High-value threshold
  if (recent.currency === "USD" && recent.amount > 50000) flags.push("High-value transaction (>50,000 USD)");

  return flags;
}

export function recalculateRiskScore(profile, anomalies) {
  let score = 0;
  const tagScores = { low_risk: 0, medium_risk: 20, high_watch: 50, blacklisted: 90 };
  score += tagScores[profile.baseline_risk_tag] || 0;
  score += Math.min(anomalies.length * 8, 30);
  if (profile.sanctions_check === "match") score += 30;
  else if (profile.sanctions_check === "partial_match") score += 15;
  if (profile.pep_check === "match") score += 10;
  score += Math.round((profile.collusion_probability || 0) * 20);
  score = Math.min(score, 100);
  const level = score >= 75 ? "critical" : score >= 55 ? "high" : score >= 30 ? "medium" : "low";
  return { score, level };
}

// ─── RELATIONSHIP & LINK MAPPING ─────────────────────────────────────────────

export async function mapRelationships(profile, allProfiles) {
  const allTxns = await base44.entities.Transaction.list("-created_date", 500);
  const normName = normalizeName(profile.legal_name);

  const counterparties = {};
  allTxns.filter((t) => normalizeName(t.vendor) === normName).forEach((t) => {
    const cp = extractCounterparty(t);
    if (cp) {
      if (!counterparties[cp]) counterparties[cp] = { name: cp, count: 0, total: 0 };
      counterparties[cp].count++;
      counterparties[cp].total += t.amount || 0;
    }
  });

  const shared = [];
  for (const p of allProfiles) {
    if (p.id === profile.id) continue;
    const myAccounts = (profile.bank_accounts || []).map((a) => a.account || a);
    const theirAccounts = (p.bank_accounts || []).map((a) => a.account || a);
    const sharedAccounts = myAccounts.filter((a) => theirAccounts.includes(a));
    if (sharedAccounts.length > 0) shared.push({ entity: p.legal_name, type: "bank_account", value: sharedAccounts.join(", ") });
    if (profile.address && p.address && normalizeName(profile.address) === normalizeName(p.address)) {
      shared.push({ entity: p.legal_name, type: "address", value: profile.address });
    }
    if (profile.tax_id && p.tax_id && profile.tax_id.toLowerCase() === p.tax_id.toLowerCase()) {
      shared.push({ entity: p.legal_name, type: "tax_id", value: profile.tax_id });
    }
  }

  const linked_counterparties = Object.values(counterparties).map((cp) => ({ name: cp.name, transaction_count: cp.count, total_value: cp.total }));
  const collusion_probability = shared.length > 0 ? Math.min(shared.length * 0.25, 1) : 0;

  return { linked_counterparties, shared_identifiers: shared, collusion_probability };
}

// ─── WORKFLOW RECOMMENDATIONS ────────────────────────────────────────────────

export function determineWorkflowRecommendations(profile) {
  const recs = [];
  if (profile.risk_score >= 75) {
    recs.push("Hold all payments immediately");
    recs.push("Request KYB refresh and enhanced due diligence");
    recs.push("Escalate to senior compliance officer");
  } else if (profile.risk_score >= 55) {
    recs.push("Hold payment pending manual review");
    recs.push("Request updated KYB documentation");
  } else if (profile.risk_score >= 30) {
    recs.push("Approve with enhanced monitoring");
    recs.push("Schedule periodic risk review");
  } else {
    recs.push("Approve transactions normally");
    recs.push("Maintain standard monitoring");
  }
  if (profile.sanctions_check === "match") recs.unshift("BLOCK: Sanctions match — mandatory reporting required");
  if ((profile.collusion_probability || 0) > 0.5) recs.unshift("Investigate cross-entity collusion links");
  if (profile.baseline_risk_tag === "blacklisted") recs.unshift("BLOCK: Entity is blacklisted");
  return recs;
}

// ─── AUTOMATED CASE FILE GENERATION ──────────────────────────────────────────

export async function generateCaseFile(profile, user) {
  const investigation = await base44.entities.Investigation.create(stampTenant({
    title: `Entity Investigation: ${profile.legal_name}`,
    transaction_id: profile.profile_id,
    vendor: profile.legal_name,
    status: "open",
    outcome: "pending",
    risk_level: profile.risk_level,
    investigator: user?.email || "system",
    notes: `Auto-generated case file for ${profile.legal_name}.\n\nRisk Score: ${profile.risk_score}/100\nRisk Level: ${profile.risk_level}\nAnomaly Flags: ${(profile.active_anomaly_flags || []).join(", ") || "None"}\nCollusion Probability: ${((profile.collusion_probability || 0) * 100).toFixed(0)}%\nTotal Invoices: ${profile.total_invoices}\nLifetime Exposure: ${profile.exposure_currency} ${profile.lifetime_exposure?.toLocaleString()}`,
  }, user));
  return investigation;
}

// ─── FULL SYNC: Recompute a single profile ───────────────────────────────────

export async function syncProfile(profile, allProfiles, user) {
  const transactions = await aggregateTransactions(profile);
  const rates = await fetchFxRates();
  const baseline = computeBaselineMetrics(transactions, rates);
  const anomalies = detectAnomalies(transactions, baseline);
  const { linked_counterparties, shared_identifiers, collusion_probability } = await mapRelationships(profile, allProfiles);

  const updated = {
    ...profile,
    total_invoices: baseline.total_invoices,
    lifetime_exposure: baseline.lifetime_exposure,
    avg_invoice_amount: baseline.avg_invoice_amount,
    payment_frequency_days: baseline.payment_frequency_days,
    currency_distribution: baseline.currency_distribution,
    standard_hours: baseline.standard_hours,
    typical_categories: baseline.typical_categories,
    active_anomaly_flags: anomalies,
    linked_counterparties,
    shared_identifiers,
    collusion_probability,
    last_activity: transactions.length > 0 ? transactions[0].created_date : null,
  };

  const { score, level } = recalculateRiskScore(updated, anomalies);
  updated.risk_score = score;
  updated.risk_level = level;

  const trend = [...(profile.risk_trend || []), { date: new Date().toISOString().split("T")[0], score }];
  if (trend.length > 30) trend.shift();
  updated.risk_trend = trend;

  updated.workflow_recommendations = determineWorkflowRecommendations(updated);

  // Auto case file generation when risk threshold exceeded
  if (score >= 65 && !profile.case_file_ref) {
    try {
      const caseFile = await generateCaseFile(updated, user);
      updated.case_file_ref = caseFile.id;
      updated.status = "under_review";
    } catch (e) {
      console.error("Case file generation failed", e);
    }
  }

  const { id, ...updateData } = updated;
  await base44.entities.EntityProfile.update(profile.id, updateData);
  return { ...updated, id: profile.id };
}

// ─── RECOMPUTE ALL PROFILES ──────────────────────────────────────────────────

export async function recomputeAllProfiles(user, onProgress) {
  const profiles = await base44.entities.EntityProfile.list("-created_date", 200);
  const results = [];
  for (let i = 0; i < profiles.length; i++) {
    try {
      const updated = await syncProfile(profiles[i], profiles, user);
      results.push(updated);
    } catch (e) {
      console.error(`Failed to sync ${profiles[i].legal_name}`, e);
      results.push(profiles[i]);
    }
    if (onProgress) onProgress(i + 1, profiles.length);
  }
  return results;
}

// ─── PROCESS NEW TRANSACTION (main orchestrator) ────────────────────────────

export async function processNewTransaction(txn, user) {
  const profiles = await base44.entities.EntityProfile.list("-created_date", 200);
  const extracted = extractEntityFromTransaction(txn, "vendor");
  const { match, matchType } = resolveEntity(extracted, profiles);

  let profile;
  if (match) {
    profile = match;
  } else {
    profile = await createEntityProfile(extracted, user);
  }

  const synced = await syncProfile(profile, [...profiles, profile], user);
  return { profile: synced, isNew: !match, matchType };
}

// ─── MERGE ENTITIES ──────────────────────────────────────────────────────────

export async function mergeEntities(sourceId, targetId, user) {
  const source = await base44.entities.EntityProfile.get(sourceId);
  const target = await base44.entities.EntityProfile.get(targetId);
  if (!source || !target) throw new Error("Source or target entity not found");

  // Reassign all transactions from source vendor name to target vendor name
  await base44.entities.Transaction.updateMany(
    { vendor: source.legal_name },
    { $set: { vendor: target.legal_name } }
  );

  // Merge bank accounts
  const targetAccounts = target.bank_accounts || [];
  const sourceAccounts = source.bank_accounts || [];
  const mergedAccounts = [...targetAccounts];
  for (const sa of sourceAccounts) {
    if (!mergedAccounts.some((a) => (a.account || a) === (sa.account || sa))) mergedAccounts.push(sa);
  }

  await base44.entities.EntityProfile.update(targetId, {
    bank_accounts: mergedAccounts,
    total_invoices: (target.total_invoices || 0) + (source.total_invoices || 0),
    lifetime_exposure: (target.lifetime_exposure || 0) + (source.lifetime_exposure || 0),
  });

  await base44.entities.EntityProfile.delete(sourceId);
  await logActivitySafe(user, "entity_merge", `Merged "${source.legal_name}" into "${target.legal_name}"`, "EntityProfile", targetId);

  // Re-sync the target profile
  const allProfiles = await base44.entities.EntityProfile.list("-created_date", 200);
  return await syncProfile({ ...target, bank_accounts: mergedAccounts, id: targetId }, allProfiles, user);
}

async function logActivitySafe(user, action, detail, entityType, entityId) {
  try {
    const { logActivity } = await import("@/lib/activityLogger");
    await logActivity(user, action, detail, entityType, entityId);
  } catch (e) { /* best-effort */ }
}