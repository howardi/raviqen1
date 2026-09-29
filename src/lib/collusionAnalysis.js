import { base44 } from "@/api/base44Client";

/**
 * Groups transactions by vendor and extracts shared attributes
 * for collusion link analysis.
 */
function buildVendorProfiles(transactions) {
  const profiles = {};
  transactions.forEach((t) => {
    const name = t.vendor || "Unknown";
    if (!profiles[name]) {
      profiles[name] = {
        vendor: name,
        locations: new Set(),
        paymentMethods: new Set(),
        categories: new Set(),
        transactionIds: [],
        totalAmount: 0,
        riskScores: [],
        riskLevel: t.risk_level || "low",
        count: 0,
      };
    }
    if (t.location) profiles[name].locations.add(t.location);
    if (t.payment_method) profiles[name].paymentMethods.add(t.payment_method);
    if (t.category) profiles[name].categories.add(t.category);
    if (t.transaction_id) profiles[name].transactionIds.push(t.transaction_id);
    profiles[name].totalAmount += t.amount || 0;
    if (t.risk_score) profiles[name].riskScores.push(t.risk_score);
    profiles[name].count++;
    const levelRank = { low: 0, medium: 1, high: 2, critical: 3 };
    if (levelRank[t.risk_level] > levelRank[profiles[name].riskLevel]) {
      profiles[name].riskLevel = t.risk_level;
    }
  });
  return profiles;
}

/**
 * Detects structural links between vendors based on shared attributes.
 * Returns edges with link types and confidence scores.
 */
function detectStructuralLinks(profiles) {
  const vendors = Object.values(profiles);
  const links = [];
  for (let i = 0; i < vendors.length; i++) {
    for (let j = i + 1; j < vendors.length; j++) {
      const a = vendors[i];
      const b = vendors[j];
      const sharedLocations = [...a.locations].filter((l) => b.locations.has(l));
      const sharedPayments = [...a.paymentMethods].filter((p) => b.paymentMethods.has(p));
      const sharedCategories = [...a.categories].filter((c) => b.categories.has(c));

      const signals = [];
      if (sharedLocations.length) signals.push({ type: "shared_location", detail: sharedLocations.join(", "), weight: 25 });
      if (sharedPayments.length) signals.push({ type: "shared_payment_method", detail: sharedPayments.join(", "), weight: 20 });
      if (sharedCategories.length) signals.push({ type: "shared_category", detail: sharedCategories.join(", "), weight: 15 });

      // Name similarity check (common words/token overlap)
      const tokensA = a.vendor.toLowerCase().split(/[\s,&.-]+/).filter((w) => w.length > 2);
      const tokensB = b.vendor.toLowerCase().split(/[\s,&.-]+/).filter((w) => w.length > 2);
      const sharedTokens = tokensA.filter((w) => tokensB.includes(w));
      if (sharedTokens.length) signals.push({ type: "name_similarity", detail: `Shared: ${sharedTokens.join(", ")}`, weight: 30 });

      if (signals.length) {
        const confidence = Math.min(100, signals.reduce((s, sig) => s + sig.weight, 0));
        links.push({ source: a.vendor, target: b.vendor, signals, confidence });
      }
    }
  }
  return links;
}

/**
 * Uses InvokeLLM to analyze vendor names for potential hidden corporate
 * connections (UBO overlap, registry links, related entities).
 */
async function enhanceWithIntelligence(links, profiles) {
  if (!links.length) return links;
  const vendorNames = Object.keys(profiles);
  try {
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a forensic fraud analyst. Given this list of vendor names from a financial system, identify any that may share hidden Ultimate Beneficial Owners (UBOs), parent companies, or corporate registry connections. Return a JSON array of suspected links, each with: vendor_a, vendor_b, link_reason (e.g. "shared UBO", "parent-subsidiary", "same address"), confidence (0-100). Only include plausible links — do not invent connections between clearly unrelated companies. If none found, return an empty array.

Vendor names:
${vendorNames.join("\n")}`,
      response_json_schema: {
        type: "object",
        properties: {
          links: {
            type: "array",
            items: {
              type: "object",
              properties: {
                vendor_a: { type: "string" },
                vendor_b: { type: "string" },
                link_reason: { type: "string" },
                confidence: { type: "number" },
              },
            },
          },
        },
      },
    });
    const aiLinks = res?.links || [];
    const existing = new Set(links.map((l) => `${l.source}|${l.target}`));
    aiLinks.forEach((al) => {
      const key = `${al.vendor_a}|${al.vendor_b}`;
      const reverseKey = `${al.vendor_b}|${al.vendor_a}`;
      if (existing.has(key) || existing.has(reverseKey)) {
        // Enrich existing link
        const link = links.find((l) => (l.source === al.vendor_a && l.target === al.vendor_b) || (l.source === al.vendor_b && l.target === al.vendor_a));
        if (link) {
          link.signals.push({ type: "ai_intel", detail: al.link_reason, weight: al.confidence * 0.4 });
          link.confidence = Math.min(100, link.confidence + al.confidence * 0.4);
        }
      } else {
        links.push({
          source: al.vendor_a,
          target: al.vendor_b,
          signals: [{ type: "ai_intel", detail: al.link_reason, weight: al.confidence * 0.4 }],
          confidence: al.confidence,
        });
      }
    });
  } catch (e) {
    console.error("AI collusion enhancement failed:", e);
  }
  return links;
}

/**
 * Full collusion analysis pipeline.
 * Returns { nodes, links, clusters, summary }
 */
export async function analyzeCollusion(transactions) {
  const profiles = buildVendorProfiles(transactions);
  let links = detectStructuralLinks(profiles);
  links = await enhanceWithIntelligence(links, profiles);

  // Build nodes
  const nodes = Object.values(profiles).map((p) => ({
    id: p.vendor,
    label: p.vendor,
    transactionCount: p.count,
    totalAmount: p.totalAmount,
    avgRisk: p.riskScores.length ? p.riskScores.reduce((s, r) => s + r, 0) / p.riskScores.length : 0,
    riskLevel: p.riskLevel,
    linkCount: links.filter((l) => l.source === p.vendor || l.target === p.vendor).length,
  }));

  // Identify clusters (connected components via simple BFS)
  const adjacency = {};
  links.forEach((l) => {
    adjacency[l.source] = adjacency[l.source] || new Set();
    adjacency[l.target] = adjacency[l.target] || new Set();
    adjacency[l.source].add(l.target);
    adjacency[l.target].add(l.source);
  });
  const visited = new Set();
  const clusters = [];
  nodes.forEach((n) => {
    if (visited.has(n.id)) return;
    const cluster = [];
    const queue = [n.id];
    while (queue.length) {
      const cur = queue.shift();
      if (visited.has(cur)) continue;
      visited.add(cur);
      cluster.push(cur);
      (adjacency[cur] || new Set()).forEach((nb) => {
        if (!visited.has(nb)) queue.push(nb);
      });
    }
    if (cluster.length > 1) {
      const clusterLinks = links.filter((l) => cluster.includes(l.source) && cluster.includes(l.target));
      const avgConfidence = clusterLinks.length
        ? clusterLinks.reduce((s, l) => s + l.confidence, 0) / clusterLinks.length
        : 0;
      clusters.push({
        members: cluster,
        linkCount: clusterLinks.length,
        avgConfidence: Math.round(avgConfidence),
        topSignals: clusterLinks.flatMap((l) => l.signals.map((s) => s.type)),
      });
    }
  });
  clusters.sort((a, b) => b.avgConfidence - a.avgConfidence);

  const highRiskLinks = links.filter((l) => l.confidence >= 50).length;
  const summary = {
    totalVendors: nodes.length,
    totalLinks: links.length,
    highRiskLinks,
    clusters: clusters.length,
    flaggedVendors: nodes.filter((n) => n.linkCount >= 2).length,
  };

  return { nodes, links, clusters, summary };
}