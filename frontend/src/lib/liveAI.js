export async function invokeLiveLLM({ prompt, response_json_schema }) {
  const response = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, schema: response_json_schema || null }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "AI is unavailable.");
  return data.result;
}

export async function lookupLiveMarket(payload) {
  const response = await fetch("/api/market", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  });
  const data = await response.json().catch(() => ({ items: [] }));
  if (!response.ok) return [];
  return (data.items || []).filter((row) => row?.verified === true);
}
