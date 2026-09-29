// RAVIQEN Composite, Explainable Risk Scoring Engine
//
// Final risk score = weighted combination of:
//   (a) unit-price deviation per line item (vs category benchmark)
//   (b) verifiability tier (HIGH/LOW)
//   (c) arithmetic integrity (sum line totals == stated total; qty × unit == line)
//   (d) behavioral / vendor signals
// Never a single "amount > X" rule. Every score ships with a human-readable
// explanation naming the line item(s) and factor(s) that drove it.
//
// Transactions above the composite threshold route to HUMAN REVIEW with the
// explanation attached. The system flags and explains — it never unilaterally
// declares fraud. Data integrity (Part 1) is 100%; model judgment is probabilistic.

import { classifyLineItem, benchmarkFor, deviationRatio, verifiabilityTier } from "@/lib/categoryBenchmarks";
import { riskLevelFromScore } from "@/lib/riskSeverity";

const REVIEW_THRESHOLD = 55; // score >= 55 → human review

function parseLineItems(record) {
  if (Array.isArray(record.line_items) && record.line_items.length) {
    return record.line_items.map((li) => ({
      description: String(li.description || li.item_description || li.item || ""),
      quantity: Number(li.quantity) || 1,
      unit_price: Number(li.unit_price) || 0,
      line_total: Number(li.line_total || li.amount || (li.quantity ? (li.unit_price || 0) * li.quantity : 0)) || 0,
    }));
  }
  // Single-item record
  if (record.item_description || record.description) {
    const qty = Number(record.quantity) || 1;
    const unit = Number(record.unit_price) || (record.amount ? Number(record.amount) / qty : 0);
    return [{
      description: String(record.item_description || record.description || ""),
      quantity: qty,
      unit_price: unit,
      line_total: Number(record.amount) || unit * qty || 0,
    }];
  }
  return [];
}

function statedTotal(record) {
  for (const f of ["total", "amount_due", "grand_total", "invoice_total", "amount"]) {
    if (record[f] != null && record[f] !== "") {
      const n = Number(String(record[f]).replace(/[^0-9.\-]/g, ""));
      if (!isNaN(n) && n > 0) return n;
    }
  }
  return Number(record.amount) || 0;
}

function scoreToLevel(score) {
  return riskLevelFromScore(score).toUpperCase();
}

// Score a single transaction record into a composite, explainable result.
export function scoreTransaction(record) {
  const items = parseLineItems(record);
  const total = statedTotal(record);
  const currency = String(record.currency || "USD").toUpperCase();
  const factors = [];
  const lineItemScores = [];
  let score = 5; // baseline

  // ── (a) Unit-price deviation per line item ──
  let hasBenchmark = false;
  for (const it of items) {
    const cls = classifyLineItem(it.description);
    if (!cls) {
      // Unclassified line item — minor uncertainty.
      lineItemScores.push({ description: it.description, category: null, deviation: null, note: "Unclassified — no benchmark" });
      continue;
    }
    const b = benchmarkFor(cls.category);
    const ratio = deviationRatio(it.unit_price, cls.category);
    lineItemScores.push({
      description: it.description,
      category: cls.category,
      verifiability: cls.verifiability,
      deviationRatio: ratio,
      unitPrice: it.unit_price,
      benchmarkMid: b ? b.unitPriceNGN[1] : null,
    });
    if (ratio == null) {
      // No benchmark (standby/misc) — verifiability tier drives risk, not price.
      continue;
    }
    hasBenchmark = true;
    if (ratio > 2) {
      const pts = 40;
      score += pts;
      factors.push({ factor: "price_deviation", weight: pts, detail: `"${it.description}" unit price is ${ratio.toFixed(1)}x the ${cls.category} benchmark midpoint` });
    } else if (ratio > 1.5) {
      const pts = 25;
      score += pts;
      factors.push({ factor: "price_deviation", weight: pts, detail: `"${it.description}" unit price is ${ratio.toFixed(1)}x the ${cls.category} benchmark midpoint` });
    } else if (ratio > 1.25) {
      const pts = 10;
      score += pts;
      factors.push({ factor: "price_deviation", weight: pts, detail: `"${it.description}" unit price is ${ratio.toFixed(1)}x benchmark (minor inflation)` });
    }
  }

  // ── (b) Verifiability tier ──
  const itemCats = items.map((it) => classifyLineItem(it.description)).filter(Boolean);
  const hasLowVerifiability = itemCats.some((c) => c.verifiability === "LOW");
  const allLow = itemCats.length > 0 && itemCats.every((c) => c.verifiability === "LOW");
  if (allLow) {
    score += 20;
    factors.push({ factor: "verifiability", weight: 20, detail: "All line items are LOW-verifiability (services/intangibles) — require supporting documentation before clearing" });
  } else if (hasLowVerifiability) {
    score += 12;
    factors.push({ factor: "verifiability", weight: 12, detail: "Mix of HIGH and LOW verifiability line items; LOW items require proof of work" });
  }

  // ── Insufficient itemization ──
  if (items.length === 0 || (items.length === 1 && /^(consulting|services|logistics support|miscellaneous|general)/i.test(items[0].description))) {
    score += 15;
    factors.push({ factor: "insufficient_itemization", weight: 15, detail: "Unitemized lump-sum with vague description — cannot benchmark unit price" });
  }

  // ── (c) Arithmetic integrity ──
  let mathOk = true;
  const lineSum = items.reduce((s, it) => s + (it.line_total || it.unit_price * it.quantity || 0), 0);
  if (items.length && total > 0) {
    if (Math.abs(lineSum - total) > Math.max(1, total * 0.005)) {
      mathOk = false;
      score += 25;
      factors.push({ factor: "arithmetic_mismatch", weight: 25, detail: `Line items sum to ${lineSum} but stated total is ${total}` });
    }
  }
  for (const it of items) {
    const computed = it.unit_price * it.quantity;
    if (it.line_total > 0 && Math.abs(computed - it.line_total) > Math.max(1, it.line_total * 0.005)) {
      mathOk = false;
      score += 10;
      factors.push({ factor: "arithmetic_mismatch", weight: 10, detail: `"${it.description}": quantity × unit price (${computed}) ≠ line total (${it.line_total})` });
    }
  }

  // ── (d) Behavioral / vendor signals ──
  const vendor = String(record.vendor || "").trim();
  const behavioral = [];
  if (record.is_new_vendor || record.new_vendor) {
    score += 10; behavioral.push("new_vendor");
    factors.push({ factor: "behavioral", weight: 10, detail: "New vendor with no prior verified transaction history" });
  }
  if (total > 0 && total % 1_000_000 === 0) {
    score += 6; behavioral.push("round_number");
    factors.push({ factor: "behavioral", weight: 6, detail: "Round-number total (possible estimate rather than itemized)" });
  }
  if (record.structuring_flag) {
    score += 12; behavioral.push("structuring");
    factors.push({ factor: "behavioral", weight: 12, detail: "Multiple invoices from same vendor just below approval threshold (structuring)" });
  }
  const hasDocs = record.supporting_documents || record.has_po || record.has_grn || record.has_delivery_note;
  const needsDocs = itemCats.some((c) => c.verifiability === "HIGH");
  if (needsDocs && !hasDocs) {
    score += 10; behavioral.push("missing_documents");
    factors.push({ factor: "behavioral", weight: 10, detail: "Physical goods present but no PO/GRN/delivery note attached" });
  }
  if (record.vague_description) {
    score += 6; behavioral.push("vague_description");
    factors.push({ factor: "behavioral", weight: 6, detail: "Vague/generic description instead of itemized specifics" });
  }

  score = Math.min(100, Math.round(score));
  const level = scoreToLevel(score);
  const reviewRequired = score >= REVIEW_THRESHOLD;

  const explanation = buildExplanation(record, items, factors, score, level, mathOk, hasBenchmark);
  return {
    score,
    level,
    reviewRequired,
    mathVerified: mathOk,
    factors,
    lineItemScores,
    behavioralSignals: behavioral,
    explanation,
  };
}

function buildExplanation(record, items, factors, score, level, mathOk, hasBenchmark) {
  const vendor = record.vendor || "Unknown";
  const total = statedTotal(record);
  const cur = String(record.currency || "USD");
  const head = `${vendor} (${cur} ${Number(total).toLocaleString()}) → composite score ${score} (${level}).`;
  if (!factors.length) return `${head} No risk factors: itemized, benchmarked, arithmetically consistent, documented. Routes directly to clearance.`;
  const driverList = factors
    .map((f) => `[${f.factor} +${f.weight}] ${f.detail}`)
    .join(" ");
  const tail = mathOk
    ? "Arithmetic verified (line items sum to stated total)."
    : "Arithmetic mismatch detected — data-integrity flag raised.";
  const verdict = reviewVerdict(score);
  return `${head} Drivers: ${driverList}. ${tail} ${verdict}`;
}

function reviewVerdict(score) {
  if (score >= 55) return "Routes to HUMAN REVIEW with this explanation attached — system does not auto-declare fraud.";
  if (score >= 31) return "Monitor — below human-review threshold; logged for trend analysis.";
  return "Low risk — cleared for disbursement.";
}