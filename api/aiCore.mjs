function fail(message, status = 500) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export function listingContainsPrice(text, amount) {
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

function parseModelText(text, schema) {
  if (!schema) return text;
  const start = String(text || "").indexOf("{");
  const end = String(text || "").lastIndexOf("}");
  if (start < 0 || end < start) throw fail("The AI response was not JSON.", 502);
  return JSON.parse(String(text).slice(start, end + 1));
}

const ACCURACY_RULE = "You are RAVIQEN. Answer general questions from established knowledge. For business records, cite only amounts, vendors, ids, and flags written in the user message. If a business figure is not in the message, say it is not in the records. Do not invent transactions, clearances, market prices, or report ids.";

function instructionFor(prompt, schema) {
  return schema
    ? `${prompt}\n\nReply with one JSON object only. Match this schema: ${JSON.stringify(schema)}`
    : prompt;
}

async function completeOpenAI(prompt, schema) {
  const key = process.env.OPENAI_API_KEY || process.env.AI_API_KEY;
  if (!key) throw fail("Set OPENAI_API_KEY or CURSOR_API_KEY.", 503);
  const base = (process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const response = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        { role: "system", content: ACCURACY_RULE },
        { role: "user", content: instructionFor(prompt, schema) },
      ],
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw fail(body?.error?.message || "The AI service did not respond.", response.status);
  return parseModelText(body?.choices?.[0]?.message?.content || "", schema);
}

async function completeGemini(prompt, schema) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw fail("Set GEMINI_API_KEY.", 503);
  const models = [...new Set([
    process.env.GEMINI_MODEL || "gemini-3.8-flash",
    "gemini-3-flash",
    "gemini-flash-latest",
  ])];
  let lastError = fail("Gemini did not respond.", 502);
  for (const model of models) {
    let response;
    try {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: ACCURACY_RULE }],
        },
        contents: [{ role: "user", parts: [{ text: instructionFor(prompt, schema) }] }],
        generationConfig: { temperature: 0 },
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (response.ok) {
      const text = (body?.candidates?.[0]?.content?.parts || []).map((part) => part.text || "").join("");
      if (text) return parseModelText(text, schema);
      lastError = fail("Gemini returned an empty answer.", 502);
      continue;
    }
    const message = body?.error?.message || "Gemini did not respond.";
    lastError = fail(message, response.status);
    console.error(`Gemini ${model} ${response.status}: ${message.slice(0, 160)}`);
    const retryable = response.status === 429 || response.status === 503 || /high demand|no longer available|not found/i.test(message);
    if (!retryable) throw lastError;
    } catch (error) {
      if (error?.status && error.status < 500 && !/high demand|no longer available|not found/i.test(error.message || "")) throw error;
      lastError = error?.status ? error : fail(error?.message || "Gemini did not respond.", 503);
      console.error(`Gemini ${model}: ${String(lastError.message || "").slice(0, 160)}`);
    }
  }
  throw lastError;
}

async function completeClaude(prompt, schema) {
  const key = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!key) throw fail("Set CLAUDE_API_KEY.", 503);
  const models = [...new Set([
    process.env.CLAUDE_MODEL || "claude-sonnet-4-5",
    "claude-sonnet-4-6",
    "claude-3-5-sonnet-latest",
  ])];
  let lastError = fail("Claude did not answer.", 502);
  for (const model of models) {
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
        },
        signal: AbortSignal.timeout(25000),
        body: JSON.stringify({
          model,
          max_tokens: 1024,
          temperature: 0,
          system: ACCURACY_RULE,
          messages: [{ role: "user", content: instructionFor(prompt, schema) }],
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = body?.error?.message || "Claude did not answer.";
        lastError = fail(message, response.status);
        if (response.status === 404 || /model/i.test(message)) continue;
        throw lastError;
      }
      const text = (body.content || []).filter((part) => part?.type === "text").map((part) => part.text || "").join("").trim();
      if (!text) {
        lastError = fail("Claude returned an empty answer.", 502);
        continue;
      }
      return parseModelText(text, schema);
    } catch (error) {
      lastError = error?.status ? error : fail(error?.message || "Claude did not answer.", 503);
      if (lastError.status === 404 || /model/i.test(lastError.message || "")) continue;
      throw lastError;
    }
  }
  throw lastError;
}

async function completeCursor(prompt, schema) {
  const key = process.env.CURSOR_API_KEY;
  if (!key) throw fail("Set CURSOR_API_KEY from Cursor Dashboard, API Keys.", 503);
  const { Agent } = await import("@cursor/sdk");
  const { tmpdir } = await import("node:os");
  const result = await Agent.prompt(instructionFor(prompt, schema), {
    apiKey: key,
    model: { id: process.env.CURSOR_MODEL || "composer-2.5" },
    tools: [],
    local: { cwd: tmpdir(), settingSources: [] },
  });
  if (result.status !== "finished") throw fail(result.error?.message || "Cursor did not answer.", 502);
  return parseModelText(result.result || "", schema);
}

async function complete(prompt, schema) {
  const steps = [];
  if (process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY) steps.push(["Claude", completeClaude]);
  if (process.env.GEMINI_API_KEY) steps.push(["Gemini", completeGemini]);
  if (process.env.OPENAI_API_KEY || process.env.AI_API_KEY) steps.push(["OpenAI", completeOpenAI]);
  if (process.env.CURSOR_API_KEY) steps.push(["Cursor", completeCursor]);
  if (!steps.length) throw fail("Set CLAUDE_API_KEY.", 503);
  let lastError = fail("No model answered.", 502);
  for (let index = 0; index < steps.length; index += 1) {
    const [name, step] = steps[index];
    try {
      return await step(prompt, schema);
    } catch (error) {
      lastError = error?.status ? error : fail(error?.message || `${name} did not answer.`, 503);
      if (index < steps.length - 1) console.error(`${name} unavailable, trying the next model: ${String(lastError.message || "").slice(0, 160)}`);
    }
  }
  throw lastError;
}

export async function runChat({ prompt, schema }) {
  if (!String(prompt || "").trim()) throw fail("A prompt is required.", 400);
  return complete(String(prompt), schema || null);
}

async function pageShowsPrice(url, price) {
  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(8000),
    headers: { "user-agent": "RaviqenPriceCheck/1.0" },
  });
  if (!response.ok) return false;
  const body = await response.text();
  return listingContainsPrice(body.slice(0, 400000), price);
}

export async function runMarket({ items = [], vendor = "", location = "Nigeria" }) {
  const list = Array.isArray(items) ? items.slice(0, 12) : [];
  if (!list.length) return [];
  const prompt = `Find one current public listing for each item. Return the exact unit price in NGN printed on that page and the https URL of that page. Do not estimate or invent a price or URL. If you cannot name a page that prints the price, leave nigerian_market_avg_ngn and market_source_url empty. Same order as the input.

ITEMS:
${list.map((item, index) => `${index + 1}. ${item.item_description} | quoted ${item.unit_price} ${item.currency || ""}`).join("\n")}
VENDOR: ${vendor || "Unknown"}
LOCATION: ${location || "Nigeria"}`;
  let quotes = [];
  try {
    const result = await complete(prompt, {
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
    });
    quotes = Array.isArray(result?.items) ? result.items : [];
  } catch {
    quotes = [];
  }
  const verified = [];
  for (const item of list) {
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
  return verified;
}
