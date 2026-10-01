import { runMarket } from "./aiCore.mjs";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST only" });
    return;
  }
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const items = await runMarket(body);
    res.status(200).json({ items });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || "Market lookup failed.", items: [] });
  }
}
