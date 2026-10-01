import { runChat } from "./aiCore.mjs";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST only" });
    return;
  }
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const result = await runChat({ prompt: body.prompt, schema: body.schema });
    res.status(200).json({ result });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || "AI request failed." });
  }
}
