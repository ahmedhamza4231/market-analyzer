// Vercel serverless function: calls Claude with web search. Key stays on the server.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!process.env.APP_PASSWORD || req.headers["x-app-password"] !== process.env.APP_PASSWORD)
    return res.status(401).json({ error: "unauthorized" });
  const prompt = (req.body && req.body.prompt) || "";
  if (!prompt || prompt.length > 6000) return res.status(400).json({ error: "bad prompt" });
  try {
    let messages = [{ role: "user", content: prompt }];
    let text = "";
    for (let i = 0; i < 4; i++) {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-5-5",
          max_tokens: 4000,
          messages,
          tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 8 }],
        }),
      });
      const j = await r.json();
      if (!r.ok) return res.status(502).json({ error: (j.error && j.error.message) || "API error" });
      text += j.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
      if (j.stop_reason !== "pause_turn") break;
      messages = [messages[0], { role: "assistant", content: j.content }];
    }
    res.status(200).json({ text });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}
