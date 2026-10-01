import { base44 } from "@/api/base44Client";
import { fetchFxRates, convertAmount } from "@/lib/currencyUtils";

/**
 * Fetches all relevant entity data for conversational analytics context.
 */
async function safeList(name, limit) {
  try {
    const rows = await base44.entities[name].list("-created_date", limit);
    return { rows: Array.isArray(rows) ? rows : [], loaded: true };
  } catch {
    return { rows: [], loaded: false };
  }
}

async function fetchPlatformData() {
  const [transactions, alerts, investigations] = await Promise.all([
    safeList("Transaction", 200),
    safeList("Alert", 100),
    safeList("Investigation", 50),
  ]);
  return { transactions, alerts, investigations };
}

/**
 * Detects query intent and extracts filter criteria from natural language.
 */
function parseQueryIntent(query) {
  const q = query.toLowerCase();
  const intent = {
    isDataQuery: false,
    riskLevel: null,
    minAmount: null,
    category: null,
    vendor: null,
    status: null,
    entity: null,
    timePeriod: null,
  };

  // Entity detection
  if (q.includes("alert")) intent.entity = "alert";
  else if (q.includes("investigation")) intent.entity = "investigation";
  else if (q.includes("transaction") || q.includes("vendor") || q.includes("procurement") || q.includes("payroll") || q.includes("invoice")) intent.entity = "transaction";

  // Risk level
  if (q.includes("critical")) intent.riskLevel = "critical";
  else if (q.includes("high risk") || q.includes("high-risk")) intent.riskLevel = "high";
  else if (q.includes("medium risk") || q.includes("medium-risk")) intent.riskLevel = "medium";
  else if (q.includes("low risk") || q.includes("low-risk")) intent.riskLevel = "low";

  // Amount threshold (supports ₦/N/$ with M/K suffixes)
  const amountMatch = q.match(/(?:over|above|exceeding|>\s*)\s*(?:₦|ngn|n|naira|\$|usd)?\s*([\d,.]+)\s*([mk])?/i);
  if (amountMatch) {
    let amt = parseFloat(amountMatch[1].replace(/,/g, ""));
    if (amountMatch[2]?.toLowerCase() === "m") amt *= 1_000_000;
    if (amountMatch[2]?.toLowerCase() === "k") amt *= 1_000;
    intent.minAmount = amt;
  }

  // Category
  const categories = ["procurement", "payroll", "vendor payment", "expenses", "transfers"];
  for (const c of categories) {
    if (q.includes(c)) { intent.category = c === "vendor payment" ? "Vendor Payment" : c.charAt(0).toUpperCase() + c.slice(1); break; }
  }

  // Status
  if (q.includes("flagged")) intent.status = "flagged";
  else if (q.includes("quarantined") || q.includes("frozen")) intent.status = "quarantined";
  else if (q.includes("clean")) intent.status = "clean";
  if (q.includes("open")) intent.status = intent.status || "open";

  // Time period
  if (q.includes("this quarter") || q.includes("this q")) intent.timePeriod = "quarter";
  else if (q.includes("this month")) intent.timePeriod = "month";
  else if (q.includes("this week")) intent.timePeriod = "week";

  // Determine if this is a data query vs a general question
  intent.isDataQuery = !!(intent.entity || intent.riskLevel || intent.minAmount || intent.category || intent.status || q.includes("show") || q.includes("list") || q.includes("how many") || q.includes("count") || q.includes("summar"));

  return intent;
}

/**
 * Filters transactions based on detected intent.
 */
function filterTransactions(transactions, intent) {
  let filtered = [...transactions];
  if (intent.riskLevel) filtered = filtered.filter((t) => t.risk_level === intent.riskLevel);
  if (intent.minAmount) filtered = filtered.filter((t) => (t.amount || 0) >= intent.minAmount);
  if (intent.category) filtered = filtered.filter((t) => (t.category || "").toLowerCase().includes(intent.category.toLowerCase()));
  if (intent.status) filtered = filtered.filter((t) => t.status === intent.status);
  if (intent.vendor) filtered = filtered.filter((t) => (t.vendor || "").toLowerCase().includes(intent.vendor.toLowerCase()));

  if (intent.timePeriod === "quarter") {
    const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - 3);
    filtered = filtered.filter((t) => new Date(t.created_date || t.transaction_date) >= cutoff);
  } else if (intent.timePeriod === "month") {
    const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - 1);
    filtered = filtered.filter((t) => new Date(t.created_date || t.transaction_date) >= cutoff);
  } else if (intent.timePeriod === "week") {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7);
    filtered = filtered.filter((t) => new Date(t.created_date || t.transaction_date) >= cutoff);
  }
  return filtered;
}

/**
 * Main entry point: processes a natural language query against live platform data.
 * Returns { isDataQuery, summary, data, intent }
 */
export async function processConversationalQuery(query) {
  const intent = parseQueryIntent(query);

  if (!intent.isDataQuery) {
    return { isDataQuery: false, intent };
  }

  const loaded = await fetchPlatformData();
  if (!loaded.transactions.loaded && !loaded.alerts.loaded && !loaded.investigations.loaded) {
    return {
      isDataQuery: true,
      intent,
      summary: "Live records are not available in this preview, so I cannot count transactions, alerts, or investigations.",
      narrative: "Live records are not available in this preview, so I cannot count transactions, alerts, or investigations. I can still explain investigations, alerts, ingestion, and procurement variance.",
      data: [],
      entityLabel: "records",
    };
  }
  const transactions = loaded.transactions.rows;
  const alerts = loaded.alerts.rows;
  const investigations = loaded.investigations.rows;
  const rates = await fetchFxRates();

  let data, summary, entityLabel;
  if (intent.entity === "alert" || (!intent.entity && (query.toLowerCase().includes("alert")))) {
    let filtered = [...alerts];
    if (intent.riskLevel) filtered = filtered.filter((a) => a.risk_level === intent.riskLevel);
    if (intent.status) filtered = filtered.filter((a) => a.status === intent.status);
    data = filtered.slice(0, 20).map((a) => ({
      title: a.title, vendor: a.vendor, risk_level: a.risk_level, status: a.status,
      amount: a.amount, transaction_id: a.transaction_id,
    }));
    entityLabel = "alerts";
    summary = `Found ${filtered.length} alert(s)${intent.riskLevel ? ` with ${intent.riskLevel} risk` : ""}${intent.status ? ` and status "${intent.status}"` : ""}.`;
  } else if (intent.entity === "investigation") {
    let filtered = [...investigations];
    if (intent.riskLevel) filtered = filtered.filter((i) => i.risk_level === intent.riskLevel);
    if (intent.status) filtered = filtered.filter((i) => i.status === intent.status);
    data = filtered.slice(0, 20).map((i) => ({
      title: i.title, vendor: i.vendor, risk_level: i.risk_level, status: i.status,
    }));
    entityLabel = "investigations";
    summary = `Found ${filtered.length} investigation(s) matching your criteria.`;
  } else {
    const filtered = filterTransactions(transactions, intent);
    data = filtered.slice(0, 20).map((t) => ({
      vendor: t.vendor, amount: t.amount, risk_level: t.risk_level, status: t.status,
      category: t.category, transaction_id: t.transaction_id,
    }));
    entityLabel = "transactions";
    const totalExposure = filtered.filter((t) => t.status === "flagged").reduce(
      (s, t) => s + (rates ? convertAmount(Number(t.amount) || 0, t.currency || "USD", "USD", rates) : (Number(t.amount) || 0)),
      0
    );
    summary = `Found ${filtered.length} transaction(s)${intent.riskLevel ? ` with ${intent.riskLevel} risk` : ""}${intent.minAmount ? ` over $${intent.minAmount.toLocaleString()}` : ""}${intent.category ? ` in ${intent.category}` : ""}. Total flagged exposure: $${totalExposure.toLocaleString()}.`;
  }

  // Generate AI narrative on the filtered data
  let narrative = "";
  try {
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `You are RAVIQEN's analytics assistant. A user asked: "${query}"

The system filtered the live database and found: ${summary}

Here is the filtered data (up to 20 records):
${JSON.stringify(data, null, 2)}

Provide a concise, professional response that:
1. Directly answers the user's question using this real data
2. Highlights key patterns, totals, or outliers
3. Suggests a recommended action if relevant

Keep it under 150 words. Use bullet points for lists of items.`,
    });
    narrative = typeof res === "string" ? res : res?.answer || res?.response || "";
  } catch (e) {
    narrative = summary;
  }

  return { isDataQuery: true, intent, summary, data, narrative, entityLabel };
}