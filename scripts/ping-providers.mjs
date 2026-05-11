import { config } from "dotenv";
config({ path: ".env.local" });

const checks = [
  // LLM
  { name: "Anthropic", env: "ANTHROPIC_API_KEY", url: "https://api.anthropic.com/v1/models", headers: (k) => ({ "x-api-key": k, "anthropic-version": "2023-06-01" }) },
  { name: "OpenAI",    env: "OPENAI_API_KEY",    url: "https://api.openai.com/v1/models",        headers: (k) => ({ Authorization: `Bearer ${k}` }) },
  { name: "DeepSeek",  env: "DEEPSEEK_API_KEY",  url: "https://api.deepseek.com/v1/models",      headers: (k) => ({ Authorization: `Bearer ${k}` }) },
  { name: "Perplexity",env: "PERPLEXITY_API_KEY",url: "https://api.perplexity.ai/chat/completions", method: "POST", body: JSON.stringify({ model: "sonar", messages: [{ role: "user", content: "hi" }], max_tokens: 1 }), headers: (k) => ({ Authorization: `Bearer ${k}`, "Content-Type": "application/json" }) },

  // Search / Browse
  { name: "Tavily",    env: "TAVILY_API_KEY",    url: "https://api.tavily.com/search", method: "POST", body: JSON.stringify({ query: "ping", max_results: 1 }), headers: (k) => ({ "Content-Type": "application/json" }), prepBody: (k, b) => JSON.stringify({ ...JSON.parse(b), api_key: k }) },
  { name: "Exa",       env: "EXA_API_KEY",       url: "https://api.exa.ai/search", method: "POST", body: JSON.stringify({ query: "ping", numResults: 1 }), headers: (k) => ({ "x-api-key": k, "Content-Type": "application/json" }) },
  { name: "Browserbase", env: "BROWSERBASE_API_KEY", url: "https://api.browserbase.com/v1/projects", headers: (k) => ({ "x-bb-api-key": k }) },
  { name: "Apollo",    env: "APOLLO_API_KEY",    url: "https://api.apollo.io/v1/auth/health", headers: (k) => ({ "X-Api-Key": k }) },
  { name: "PeopleDataLabs", env: "PDL_API_KEY",  url: "https://api.peopledatalabs.com/v5/account/usage", headers: (k) => ({ "X-Api-Key": k }) },

  // Media
  { name: "ElevenLabs", env: "ELEVENLABS_API_KEY", url: "https://api.elevenlabs.io/v1/user", headers: (k) => ({ "xi-api-key": k }) },
  { name: "Deepgram",   env: "DEEPGRAM_API_KEY",   url: "https://api.deepgram.com/v1/projects", headers: (k) => ({ Authorization: `Token ${k}` }) },
  { name: "Hume",       env: "HUME_API_KEY",       url: "https://api.hume.ai/v0/batch/jobs", headers: (k) => ({ "X-Hume-Api-Key": k }) },
  { name: "Runway",     env: "RUNWAY_API_KEY",     url: "https://api.dev.runwayml.com/v1/organization", headers: (k) => ({ Authorization: `Bearer ${k}`, "X-Runway-Version": "2024-11-06" }) },
  { name: "HeyGen",     env: "HEYGEN_API_KEY",     url: "https://api.heygen.com/v1/user/me", headers: (k) => ({ "X-Api-Key": k }) },
  { name: "FAL",        env: "FAL_KEY",            url: "https://queue.fal.run/", headers: (k) => ({ Authorization: `Key ${k}` }) },
  { name: "Meshy",      env: "MESHY_API_KEY",      url: "https://api.meshy.ai/openapi/v2/text-to-3d/", headers: (k) => ({ Authorization: `Bearer ${k}` }) },
  { name: "LlamaCloud", env: "LLAMA_CLOUD_API_KEY", url: "https://api.cloud.llamaindex.ai/api/v1/projects", headers: (k) => ({ Authorization: `Bearer ${k}` }) },
  { name: "Recall",     env: "RECALL_API_KEY",     url: "https://us-east-1.recall.ai/api/v1/bot/", headers: (k) => ({ Authorization: `Token ${k}` }) },

  // Infra / observability
  { name: "Resend",     env: "RESEND_API_KEY",    url: "https://api.resend.com/domains", headers: (k) => ({ Authorization: `Bearer ${k}` }) },
  { name: "Composio",   env: "COMPOSIO_API_KEY",  url: "https://backend.composio.dev/api/v1/auth_apps", headers: (k) => ({ "x-api-key": k }) },
  { name: "Langfuse",   env: "LANGFUSE_PUBLIC_KEY", url: (process.env.LANGFUSE_HOST ?? "https://cloud.langfuse.com") + "/api/public/health", headers: (k) => ({ Authorization: "Basic " + Buffer.from(k + ":" + (process.env.LANGFUSE_SECRET_KEY ?? "")).toString("base64") }) },
  { name: "Arcjet",     env: "ARCJET_KEY",        url: "https://decide.arcjet.com/", headers: (k) => ({ Authorization: `Bearer ${k}` }) },
  { name: "Upstash Redis", env: "UPSTASH_REDIS_REST_TOKEN", url: (process.env.UPSTASH_REDIS_REST_URL ?? "") + "/ping", headers: (k) => ({ Authorization: `Bearer ${k}` }) },
  { name: "Sentry",     env: "SENTRY_AUTH_TOKEN", url: "https://sentry.io/api/0/organizations/" + (process.env.SENTRY_ORG ?? "") + "/", headers: (k) => ({ Authorization: `Bearer ${k}` }) },
  { name: "Axiom",      env: "AXIOM_TOKEN",       url: "https://api.axiom.co/v1/datasets", headers: (k) => ({ Authorization: `Bearer ${k}` }) },
];

const pad = (s, n) => s + " ".repeat(Math.max(0, n - s.length));

async function ping(c) {
  const key = process.env[c.env];
  if (!key) return { name: c.name, status: "MISSING", code: "—", note: c.env + " not set" };
  let url = typeof c.url === "function" ? c.url() : c.url;
  let body = c.body;
  if (c.prepBody) body = c.prepBody(key, body);
  try {
    const res = await fetch(url, {
      method: c.method ?? "GET",
      headers: c.headers(key),
      body,
      signal: AbortSignal.timeout(8000),
    });
    const code = res.status;
    let status;
    if (code >= 200 && code < 300) status = "OK";
    else if (code === 401 || code === 403) status = "AUTH FAIL";
    else if (code === 404) status = "404 (route)";
    else if (code === 405) status = "OK (route reachable)";
    else if (code === 429) status = "RATE LIMITED";
    else if (code >= 400 && code < 500) status = "OK (4xx — key valid)";
    else status = "HTTP " + code;
    return { name: c.name, status, code };
  } catch (e) {
    return { name: c.name, status: "NETWORK", code: "—", note: e.message };
  }
}

console.log(pad("Provider", 22) + pad("Status", 24) + "Code");
console.log("─".repeat(60));
const results = await Promise.allSettled(checks.map(ping));
for (const r of results) {
  if (r.status !== "fulfilled") { console.log("?? agent crash:", r.reason); continue; }
  const { name, status, code, note } = r.value;
  console.log(pad(name, 22) + pad(status, 24) + String(code) + (note ? "  " + note : ""));
}
