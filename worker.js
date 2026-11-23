// Winter Watch relay — Cloudflare Worker
// Holds the AI key as a secret so the public page never contains it.
//
// Worker settings → Variables and Secrets:
//   API_KEY        (Secret)  your provider key
//   PROVIDER       (Text)    openai | anthropic | google | groq
//   MODEL          (Text)    e.g. gpt-4o-mini, claude-haiku-4-5, gemini-2.5-flash, llama-3.3-70b-versatile
//   ALLOWED_ORIGIN (Text)    https://YOUR-USERNAME.github.io

const MAX_INPUT_CHARS = 80000;  // stops anyone sending huge requests through your key
const MAX_OUTPUT_TOKENS = 1500;

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = env.ALLOWED_ORIGIN || "";
    const cors = {
      "Access-Control-Allow-Origin": allowed,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin",
    };
    const reply = (obj, status = 200) =>
      new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return reply({ error: "POST only" }, 405);
    if (!allowed || origin !== allowed) return reply({ error: "Origin not allowed" }, 403);

    let body;
    try { body = await request.json(); } catch { return reply({ error: "Bad JSON" }, 400); }
    const system = String(body.system || ""), user = String(body.user || "");
    if (!user) return reply({ error: "Missing question" }, 400);
    if (system.length + user.length > MAX_INPUT_CHARS) return reply({ error: "Request too large" }, 413);

    const provider = env.PROVIDER, model = env.MODEL, key = env.API_KEY;
    let url, headers = { "Content-Type": "application/json" }, payload;
    if (provider === "openai" || provider === "groq") {
      url = provider === "openai" ? "https://api.openai.com/v1/chat/completions" : "https://api.groq.com/openai/v1/chat/completions";
      headers.Authorization = "Bearer " + key;
      payload = { model, max_tokens: MAX_OUTPUT_TOKENS, temperature: 0.2,
                  messages: [{ role: "system", content: system }, { role: "user", content: user }] };
    } else if (provider === "anthropic") {
      url = "https://api.anthropic.com/v1/messages";
      Object.assign(headers, { "x-api-key": key, "anthropic-version": "2023-06-01" });
      payload = { model, max_tokens: MAX_OUTPUT_TOKENS, temperature: 0.2, system, messages: [{ role: "user", content: user }] };
    } else if (provider === "google") {
      url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
      headers["x-goog-api-key"] = key;
      payload = { systemInstruction: { parts: [{ text: system }] }, contents: [{ role: "user", parts: [{ text: user }] }],
                  generationConfig: { temperature: 0.2, maxOutputTokens: MAX_OUTPUT_TOKENS } };
    } else return reply({ error: "PROVIDER not set on the Worker" }, 500);

    const r = await fetch(url, { method: "POST", headers, body: JSON.stringify(payload) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return reply({ error: `${provider} ${r.status}: ${j.error?.message || "error"}` }, r.status);

    let text, inTok, outTok;
    if (provider === "anthropic") { text = j.content?.map(c => c.text || "").join(""); inTok = j.usage?.input_tokens; outTok = j.usage?.output_tokens; }
    else if (provider === "google") { text = j.candidates?.[0]?.content?.parts?.map(p => p.text || "").join(""); inTok = j.usageMetadata?.promptTokenCount; outTok = j.usageMetadata?.candidatesTokenCount; }
    else { text = j.choices?.[0]?.message?.content; inTok = j.usage?.prompt_tokens; outTok = j.usage?.completion_tokens; }
    return reply({ text: text || "(empty reply)", inTok: inTok || 0, outTok: outTok || 0, provider: provider + " via relay", model });
  },
};
