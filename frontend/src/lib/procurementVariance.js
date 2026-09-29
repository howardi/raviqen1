// RAVIQEN Procurement Pricing & Market Variance Engine
// Phase 1: Line-item extraction + currency normalization to NGN (parallel market)
// Phase 2: Live Nigerian market indexing via web search + variance calculation
// Phase 3: RULE-PG-01 / PG-02 / PG-03 discrepancy flagging

import { base44 } from "@/api/base44Client";
import { formatCurrency } from "@/lib/currencyUtils";

// Comparisons use a fetched rate only: never manufacture a parallel-market rate.
const ACCEPTABLE_BUFFER_PCT = 25;   // RULE-PG-01 ceiling (+25%)
const MEDIUM_INFLATION_CEILING_PCT = 50; // RULE-PG-02 ceiling (+50%)

let _ratesCache = null;
async function getRates() {
  if (_ratesCache) return _ratesCache;
  const res = await fetch("https://open.er-api.com/v6/latest/USD");
  if (!res.ok) throw new Error("Exchange rates unavailable");
  const data = await res.json();
  if (!data?.rates?.NGN) throw new Error("NGN exchange rate unavailable");
  _ratesCache = data.rates;
  return _ratesCache;
}

export async function toNGN(amount, currency) {
  const cur = String(currency || "").toUpperCase();
  if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) return null;
  if (cur === "NGN") return Number(amount);
  if (!cur) return null;
  try {
    const rates = await getRates();
    return rates[cur] ? Number(amount) / rates[cur] * rates.NGN : null;
  } catch {
    return null;
  }
}

// ─── Phase 1: Line-item extraction & standardization ───────────────────────
export function extractLineItems(record) {
  const items = [];
  if (Array.isArray(record.line_items) && record.line_items.length) {
    for (const li of record.line_items) {
      const desc = li.item_description || li.description || li.item || "";
      const qty = Number(li.quantity ?? li.qty ?? 1);
      const explicitPrice = li.unit_price ?? li.rate ?? li.unit_cost;
      const total = li.line_total ?? li.amount;
      const unitPrice = explicitPrice != null && explicitPrice !== "" ? Number(explicitPrice) : (total != null && qty > 0 ? Number(total) / qty : null);
      if (desc && qty > 0 && Number.isFinite(unitPrice) && unitPrice > 0) {
        items.push({ item_description: String(desc), quantity: qty, unit_price: unitPrice, line_total: total != null && total !== "" ? Number(total) : null, currency: li.currency || record.currency });
      }
    }
  }
  if (items.length === 0 && record.item_description) {
    const qty = Number(record.quantity ?? 1);
    const explicitPrice = record.unit_price;
    const unitPrice = explicitPrice != null && explicitPrice !== "" ? Number(explicitPrice) : (Number(record.amount) > 0 && qty > 0 ? Number(record.amount) / qty : null);
    if (qty > 0 && Number.isFinite(unitPrice) && unitPrice > 0) {
      items.push({ item_description: String(record.item_description), quantity: qty, unit_price: unitPrice, line_total: record.line_total != null ? Number(record.line_total) : null, currency: record.currency });
    }
  }
  return items;
}

// Detect whether a record represents a procurement document (invoice / PO / goods)
// so the variance engine runs only on relevant ingested records.
export function isProcurementRecord(record) {
  if (!record) return false;
  if (Array.isArray(record.line_items) && record.line_items.length > 0) return true;
  if (record.item_description && String(record.item_description).trim()) return true;
  const docType = String(record.document_type || "").toLowerCase();
  if (docType.includes("invoice") || docType.includes("purchase order") || docType.includes("po") || docType.includes("procurement") || docType.includes("receipt")) return true;
  const cat = String(record.category || "").toLowerCase();
  if (cat.includes("procurement") || cat.includes("invoice") || cat.includes("equipment") || cat.includes("supplies") || cat.includes("goods") || cat.includes("asset")) return true;
  return false;
}

// ─── Phase 2: Live market indexing (LLM + web search) ───────────────────────
const MARKET_PRICE_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          item_description: { type: "string" },
          nigerian_market_avg_ngn: { type: "number", description: "Current average market price in Nigerian Naira" },
          market_basis: { type: "string", description: "What comparable specification, unit and location this quoted price covers" },
          market_source_url: { type: "string", description: "Direct URL to the publicly visible listed price used (empty if none)" },
          confidence: { type: "string", enum: ["low", "medium", "high"] },
        },
        required: ["item_description"],
      },
    },
    overall_market_note: { type: "string" },
  },
  required: ["items"],
};

async function fetchMarketPrices(items, record) {
  const prompt = `You are a Nigerian procurement pricing intelligence engine. For each product listed below, determine the CURRENT average market price in Nigeria (in Naira, NGN) as of today. Use live web search across Nigerian B2B marketplaces, e-commerce platforms (Jumia, Konga, Jiji, Kara), manufacturer/distributor price lists, and industry pricing indices.

Return exactly one entry per item, IN THE SAME ORDER, with a current Nigerian market unit price and a direct public URL showing the price. Do not invent prices, URLs, product specifications, or sources. If no comparable public price exists, omit the numeric market price and leave market_source_url empty. Explain product specification and unit comparability in market_basis. A price difference is a review signal, not proof of fraud.

ITEMS:
${items.map((it, i) => `${i + 1}. ${it.item_description} (qty ${it.quantity}, quoted unit price ${it.unit_price} ${it.currency || "currency unknown"})`).join("\n")}

VENDOR: ${record.vendor || "Unknown"}
LOCATION: ${record.location || "Nigeria"}`;

  const result = await base44.integrations.Core.InvokeLLM({
    prompt,
    add_context_from_internet: true,
    model: "gemini_3_flash",
    response_json_schema: MARKET_PRICE_SCHEMA,
  });
  return result?.items || [];
}

// ─── Phase 3: Variance calculation & rule classification ────────────────────
export function classifyVariance(variancePct) {
  if (variancePct <= ACCEPTABLE_BUFFER_PCT) {
    return { status: "Within pricing review threshold", flagged_rule: "RULE-PG-01", severity: "low" };
  }
  if (variancePct <= MEDIUM_INFLATION_CEILING_PCT) {
    return { status: "Quoted price above comparable listing — review", flagged_rule: "RULE-PG-02", severity: "medium" };
  }
  return { status: "Large quoted price gap — urgent review", flagged_rule: "RULE-PG-03", severity: "critical" };
}

function computeOverallRisk(analysis) {
  const hasCritical = analysis.some((a) => a.flagged_rule === "RULE-PG-03");
  const hasMedium = analysis.some((a) => a.flagged_rule === "RULE-PG-02");
  if (hasCritical) {
    return {
      level: "CRITICAL",
      action: "Review the quoted unit prices and comparable market listings with procurement; a price gap alone does not establish fraud."
    };
  }
  if (hasMedium) {
    return {
      level: "MEDIUM",
      action: "Request competitive market bids or vendor price justification before disbursement.",
    };
  }
  if (analysis.some((a) => !a.flagged_rule)) return { level: "INSUFFICIENT_DATA", action: "Some items lack a comparable cited market price or exchange rate. Obtain comparable quotes before concluding." };
  return { level: "LOW", action: "Compared prices are within the review threshold; this is not a payment approval." };
}

function fmtNGN(n) {
  if (n == null || !Number.isFinite(Number(n))) return "Unavailable";
  return `₦${Math.round(Number(n)).toLocaleString()}`;
}

// ─── Full pipeline ──────────────────────────────────────────────────────────
export async function analyzeProcurementVariance(record, { skipMarket = false } = {}) {
  const items = extractLineItems(record);
  if (!items.length) return null;

  // Phase 1: normalize quoted unit prices to NGN using a published FX rate.
  const itemsNGN = await Promise.all(
    items.map(async (it) => ({
      ...it,
      invoice_unit_price_ngn: await toNGN(it.unit_price, it.currency || record.currency),
    }))
  );

  // Phase 2: live market indexing
  let marketItems = [];
  let marketError = null;
  if (!skipMarket) {
    try {
      marketItems = await fetchMarketPrices(itemsNGN, record);
    } catch (e) {
      marketError = e.message;
    }
  }

  // Compare only prices supported by a cited listing and a usable FX rate.
  const analysis = itemsNGN.map((it, idx) => {
    const market = marketItems[idx] || {};
    let sourceUrl = "";
    try {
      const url = new URL(market.market_source_url);
      if (["https:", "http:"].includes(url.protocol)) sourceUrl = url.href;
    } catch { /* No cited listing */ }
    const marketAvg = Number(market.nigerian_market_avg_ngn);
    const invoice = it.invoice_unit_price_ngn;
    const sameItem = String(market.item_description || "").trim().toLowerCase() === it.item_description.trim().toLowerCase();
    const comparable = !!sourceUrl && sameItem && Number.isFinite(marketAvg) && marketAvg > 0 && invoice != null;
    const variancePct = comparable ? ((invoice - marketAvg) / marketAvg) * 100 : null;
    const rule = comparable ? classifyVariance(variancePct) : null;
    const mathMismatch = Number.isFinite(it.line_total) && Math.abs(it.line_total - it.unit_price * it.quantity) > Math.max(1, it.line_total * 0.01);
    const status = !comparable ? "Market comparison unavailable — obtain a comparable source and exchange rate" : rule.status;
    const comparison = comparable
      ? `${it.quantity} × ${fmtNGN(invoice)} quoted per unit versus ${fmtNGN(marketAvg)} market per unit; ${variancePct >= 0 ? "+" : ""}${variancePct.toFixed(1)}% difference (${fmtNGN((invoice - marketAvg) * it.quantity)} total difference). ${rule.flagged_rule === "RULE-PG-01" ? "Within the 25% review threshold." : "Above the 25% review threshold; investigate specifications, delivery, tax and contract terms."}`
      : `Quoted ${formatCurrency(it.unit_price, it.currency)} per unit for ${it.quantity} unit(s). No sourced comparable market unit price is available; no price-variance conclusion can be drawn.`;
    return {
      item_description: it.item_description,
      quantity: it.quantity,
      quoted_unit_price: formatCurrency(it.unit_price, it.currency),
      invoice_unit_price: fmtNGN(invoice),
      nigerian_market_avg: comparable ? fmtNGN(marketAvg) : "Unavailable",
      calculated_variance_percent: comparable ? `${variancePct >= 0 ? "+" : ""}${variancePct.toFixed(1)}%` : "Not calculated",
      status,
      flagged_rule: rule?.flagged_rule || null,
      market_basis: comparable ? (market.market_basis || "Listing specification not provided — verify comparability") : "No cited comparable listing",
      market_source_url: comparable ? sourceUrl : "",
      confidence: comparable ? (market.confidence || "low") : "unavailable",
      comparison,
      arithmetic_finding: mathMismatch ? `Quoted line total ${formatCurrency(it.line_total, it.currency)} differs from ${it.quantity} × ${formatCurrency(it.unit_price, it.currency)} = ${formatCurrency(it.quantity * it.unit_price, it.currency)}. Possible invoice arithmetic manipulation — verify with the source document.` : "",
      _variancePct: variancePct,
      _invoiceNGN: invoice,
      _marketNGN: comparable ? marketAvg : null,
      _severity: rule?.severity || null,
    };
  });

  const overall = computeOverallRisk(analysis);
  if (analysis.some((a) => a.arithmetic_finding)) {
    overall.level = "CRITICAL";
    overall.action = "Invoice line-total arithmetic differs from quoted quantity × unit rate. Hold for document review; this is a fraud indicator, not proof of fraud.";
  }

  return {
    transaction_id: record.transaction_id,
    vendor_name: record.vendor,
    fx_basis: items.some((it) => String(it.currency).toUpperCase() !== "NGN") ? "Converted to NGN using live published USD exchange rates where available; no estimated FX applied." : "Original quoted currency: NGN; no FX conversion applied.",
    market_variance_analysis: analysis.map((a) => ({
      item_description: a.item_description,
      quantity: a.quantity,
      quoted_unit_price: a.quoted_unit_price,
      invoice_unit_price: a.invoice_unit_price,
      nigerian_market_avg: a.nigerian_market_avg,
      calculated_variance_percent: a.calculated_variance_percent,
      status: a.status,
      flagged_rule: a.flagged_rule,
      market_basis: a.market_basis,
      market_source_url: a.market_source_url,
      confidence: a.confidence,
      comparison: a.comparison,
      arithmetic_finding: a.arithmetic_finding,
    })),
    overall_procurement_risk: overall.level,
    recommended_action: overall.action,
    market_note: skipMarket ? "Batch scanning checks invoice arithmetic; market listing comparisons require a separate sourced review." : marketError ? `Market lookup failed: ${marketError}` : "Market listings are indicative; check the cited specification and date before treating a price gap as a fraud indicator.",
    _analysis: analysis,
  };
}

// Convenience: highest-severity procurement rule present (for risk-score folding)
export function topProcurementRule(pv) {
  if (!pv?._analysis?.length) return null;
  const arithmetic = pv._analysis.find((a) => a.arithmetic_finding);
  if (arithmetic) return { ...arithmetic, flagged_rule: "RULE-PG-04", status: "Invoice arithmetic discrepancy" };
  const critical = pv._analysis.find((a) => a.flagged_rule === "RULE-PG-03");
  if (critical) return critical;
  const medium = pv._analysis.find((a) => a.flagged_rule === "RULE-PG-02");
  return medium || null;
}