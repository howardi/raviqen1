import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

function listingContainsPrice(text: string, amount: number) {
  const target = Number(amount);
  if (!Number.isFinite(target) || target <= 0) return false;
  const tokens = String(text || "").match(/\d[\d,]*(?:\.\d+)?/g) || [];
  return tokens.some((token) => {
    const value = Number(token.replace(/,/g, ""));
    if (!Number.isFinite(value) || value <= 0) return false;
    const tolerance = Math.max(1, Math.abs(target) * 0.01);
    return Math.abs(value - target) <= tolerance;
  });
}

async function pageShowsPrice(url: string, price: number) {
  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(8000),
    headers: { "user-agent": "RaviqenPriceCheck/1.0" },
  });
  if (!response.ok) return false;
  const body = await response.text();
  return listingContainsPrice(body.slice(0, 400000), price);
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const items = Array.isArray(body.items) ? body.items.slice(0, 12) : [];
    if (!items.length) return Response.json({ items: [] });

    const prompt = `Find one current public Nigerian retail or B2B listing for each item. Return the exact unit price in NGN printed on that page and the https URL of that page. Do not estimate, average, or invent a price or URL. If you cannot open a page that prints the price, omit nigerian_market_avg_ngn and market_source_url. Same order as the input.

ITEMS:
${items.map((item, index) => `${index + 1}. ${item.item_description} | quoted ${item.unit_price} ${item.currency || ""}`).join("\n")}
VENDOR: ${body.vendor || "Unknown"}
LOCATION: ${body.location || "Nigeria"}`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: true,
      response_json_schema: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                item_description: { type: "string" },
                nigerian_market_avg_ngn: { type: "number" },
                market_basis: { type: "string" },
                market_source_url: { type: "string" },
              },
            },
          },
        },
      },
    });

    const quotes = Array.isArray(result?.items) ? result.items : [];
    const verified = [];
    for (const item of items) {
      const wanted = String(item.item_description || "").trim().toLowerCase();
      const quote = quotes.find((row) => String(row?.item_description || "").trim().toLowerCase() === wanted) || {};
      let url = "";
      try {
        const parsed = new URL(String(quote.market_source_url || ""));
        if (parsed.protocol === "https:" || parsed.protocol === "http:") url = parsed.href;
      } catch { /* no listing */ }
      const price = Number(quote.nigerian_market_avg_ngn);
      let ok = false;
      if (url && Number.isFinite(price) && price > 0) {
        try {
          ok = await pageShowsPrice(url, price);
        } catch {
          ok = false;
        }
      }
      verified.push({
        item_description: item.item_description,
        nigerian_market_avg_ngn: ok ? price : null,
        market_basis: ok ? (quote.market_basis || "Price printed on the cited page") : "",
        market_source_url: ok ? url : "",
        verified: ok,
        confidence: ok ? "high" : "unavailable",
      });
    }
    return Response.json({ items: verified });
  } catch (error) {
    return Response.json({ error: error.message || "Market lookup failed.", items: [] }, { status: 500 });
  }
}
