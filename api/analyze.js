// Vercel serverless function: calls Gemini with Google Search grounding. Key stays on the server.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!process.env.APP_PASSWORD || req.headers["x-app-password"] !== process.env.APP_PASSWORD)
    return res.status(401).json({ error: "unauthorized" });
  const prompt = (req.body && req.body.prompt) || "";
  if (!prompt || prompt.length > 6000) return res.status(400).json({ error: "bad prompt" });
  const model = process.env.GEMINI_MODEL || "gemini-4-hydrogen";
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
        }),
      }
    );
    const j = await r.json();
    if (!r.ok) return res.status(502).json({ error: (j.error && j.error.message) || "Gemini API error" });
    const cand = (j.candidates && j.candidates[0]) || {};
    let text = ((cand.content && cand.content.parts) || []).map((p) => p.text || "").join("\n").trim();
    if (!text) return res.status(502).json({ error: "رد فاضي من Gemini، جرّب تاني." });
    const chunks = (cand.groundingMetadata && cand.groundingMetadata.groundingChunks) || [];
    const seen = new Set();
    const links = chunks
      .map((c) => c.web)
      .filter((w) => w && w.uri && !seen.has(w.uri) && seen.add(w.uri))
      .slice(0, 10)
      .map((w) => `- [${w.title || w.uri}](${w.uri})`);
    if (links.length) text += "\n\n---\n**المصادر:**\n" + links.join("\n");
    res.status(200).json({ text });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}
