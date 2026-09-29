// RAVIQEN Category Benchmark Table & Verifiability Tiers
//
// (d) A reference table of typical market unit-price ranges per goods/service
//     category, used by the composite scoring engine to compute price-deviation
//     ratios (actual unit price / benchmark midpoint) instead of flagging on total.
// (e) Every category carries a verifiability tier:
//       HIGH — serialized/physical goods checkable against delivery notes, GRNs,
//              serial numbers, warranty docs (appliances, equipment, vehicles).
//       LOW  — services/intangibles with no physical proof of delivery (consulting,
//              logistics support, stand-by payment, printing, miscellaneous services).
//     LOW-verifiability items carry a higher base-risk multiplier and require
//     supporting documentation before clearing, regardless of amount.
//
// Sourcing: midpoints/ranges are seeded from Nigerian B2B marketplace and
// distributor price data (Jumia, Konga, Jiji, Kara, manufacturer lists) and are
// refreshed periodically via the live market-indexing path in procurementVariance.js.
// The static table guarantees deterministic, auditable scoring; the live path
// overrides per-item when available and is logged as the market basis.

export const CATEGORY_BENCHMARKS = [
  { category: "generator", keywords: ["generator", "kva", "inverter", "ups", "solar panel", "battery bank"], unit: "unit", unitPriceNGN: [4_000_000, 9_000_000, 18_000_000], verifiability: "HIGH" },
  { category: "heavy_equipment", keywords: ["excavator", "bulldozer", "crane", "dredger", "forklift", "tractor", "heavy machinery", "caterpillar", "stockpillar"], unit: "unit", unitPriceNGN: [15_000_000, 45_000_000, 120_000_000], verifiability: "HIGH" },
  { category: "vehicles", keywords: ["vehicle", "truck", "van", "bus", "toyota", "mercedes", "hilux", "car"], unit: "unit", unitPriceNGN: [8_000_000, 25_000_000, 65_000_000], verifiability: "HIGH" },
  { category: "appliances", keywords: ["air conditioner", "ac unit", "refrigerator", "freezer", "microwave", "oven", "cooker", "washing machine"], unit: "unit", unitPriceNGN: [120_000, 450_000, 1_200_000], verifiability: "HIGH" },
  { category: "electronics", keywords: ["laptop", "desktop", "server", "printer", "router", "switch", "monitor", "television", "tv", "cctv", "camera"], unit: "unit", unitPriceNGN: [80_000, 350_000, 1_500_000], verifiability: "HIGH" },
  { category: "construction_materials", keywords: ["cement", "rebar", "steel", "sand", "granite", "blocks", "paint", "tiles", "lumber", "plywood", "cabling", "cable"], unit: "ton|bag|unit", unitPriceNGN: [5_000, 35_000, 180_000], verifiability: "HIGH" },
  { category: "office_supplies", keywords: ["toner", "cartridge", "paper ream", "stationery", "furniture", "desk", "chair"], unit: "unit", unitPriceNGN: [3_000, 25_000, 120_000], verifiability: "HIGH" },
  { category: "consulting", keywords: ["consulting", "advisory", "audit", "legal", "training", "facilitation", "professional services"], unit: "engagement", unitPriceNGN: [250_000, 2_500_000, 12_000_000], verifiability: "LOW" },
  { category: "logistics_services", keywords: ["logistics", "haulage", "transport", "freight", "shipping", "delivery service", "clearing"], unit: "trip|contract", unitPriceNGN: [150_000, 1_200_000, 6_000_000], verifiability: "LOW" },
  { category: "standby_payment", keywords: ["stand by payment", "standby payment", "stand-by", "retainer", "mobilization", "reservation"], unit: "lump", unitPriceNGN: [0, 0, 0], verifiability: "LOW" },
  { category: "printing", keywords: ["printing", "banners", "flyers", "publications", "branding materials", "design"], unit: "job", unitPriceNGN: [20_000, 250_000, 1_500_000], verifiability: "LOW" },
  { category: "miscellaneous_services", keywords: ["miscellaneous", "general services", "support services", "facilitation", "logistics support", "other services", "services"], unit: "lump", unitPriceNGN: [0, 0, 0], verifiability: "LOW" },
];

const BENCHMARK_MAP = new Map(CATEGORY_BENCHMARKS.map((c) => [c.category, c]));

// Classify a line-item description into a benchmark category via keyword match.
export function classifyLineItem(description = "") {
  const hay = String(description).toLowerCase();
  if (!hay.trim()) return null;
  // Longest keyword match wins for specificity.
  let best = null;
  for (const c of CATEGORY_BENCHMARKS) {
    for (const kw of c.keywords) {
      if (hay.includes(kw)) {
        if (!best || kw.length > best.kw.length) best = { ...c, kw };
      }
    }
  }
  return best ? { category: best.category, matchedKeyword: best.kw, verifiability: best.verifiability } : null;
}

export function benchmarkFor(category) {
  return BENCHMARK_MAP.get(category) || null;
}

export function verifiabilityTier(category) {
  const b = BENCHMARK_MAP.get(category);
  return b ? b.verifiability : "LOW";
}

// Deviation ratio = actual unit price / benchmark midpoint. >1.5–2x escalates risk.
export function deviationRatio(unitPriceNGN, category) {
  const b = BENCHMARK_MAP.get(category);
  if (!b || !b.unitPriceNGN || b.unitPriceNGN[1] <= 0) return null; // no benchmark (e.g. standby/misc)
  const mid = b.unitPriceNGN[1];
  return unitPriceNGN / mid;
}

// Is this category a physical/serialized good (HIGH verifiability)?
export function isHighVerifiability(category) {
  return verifiabilityTier(category) === "HIGH";
}