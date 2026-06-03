#!/usr/bin/env node
/**
 * Harnais de mesure bout-en-bout du flow agent — LOCAL.
 *
 * Mesure 2 chemins :
 *   A. Helm direct      : POST :4102/api/orchestrate   (orchestrateur seul)
 *   B. Proxy Hive complet: POST :3031/api/cockpit-chat (Hive → Helm → Kimi → retour)
 *
 * Pour chaque chemin : TTFB réseau, 1er event SSE, chrono de CHAQUE event
 * (run_started → pré-fetch → 1er token → run_completed), cost, tokens, total.
 *
 * Prérequis : Helm (:4102) + Hive (:3031) lancés dans un terminal NATIF
 * (pas via l'agent — sandbox réseau). Lancer : node _perf-local/measure.mjs
 */
import { SignJWT } from "jose";
import { readFileSync } from "node:fs";

const HELM = "http://localhost:4102";
const HIVE = "http://127.0.0.1:3031";

function envVal(file, key) {
  try {
    const m = readFileSync(file, "utf8").match(new RegExp(`^${key}=(.*)$`, "m"));
    return m ? m[1].replace(/^["']|["']$/g, "").trim() : null;
  } catch {
    return null;
  }
}

const HIVE_ENV = "../cortex — master-vault/_hive/.env.local";
const JWT_SECRET = envVal(HIVE_ENV, "JWT_SECRET");
const HELM_TOK = envVal(HIVE_ENV, "HELM_SERVICE_TOKEN");

const uuid = () => crypto.randomUUID();
const MSG = "Explique en 3 phrases ce qu'est un orchestrateur d'agents LLM.";

async function forgeHiveToken() {
  const secret = new TextEncoder().encode(JWT_SECRET);
  return new SignJWT({
    sub: uuid(),
    tenant_id: uuid(),
    scope: ["chat"],
    jti: "perf-" + Math.floor(Math.random() * 1e9),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("hive")
    .setAudience("hive.hearst.app")
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(secret);
}

/** Lit un stream SSE et chronomètre chaque event. */
async function measureSSE(label, res, t0) {
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.log(`  ❌ HTTP ${res.status} — ${body.slice(0, 200)}`);
    return;
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let firstByte = null;
  let firstText = null;
  let textChars = 0;
  let cost = null;
  let tin = 0,
    tout = 0;
  const marks = [];
  const ev = (raw) => {
    for (const line of raw.split("\n")) {
      const s = line.trim();
      if (!s.startsWith("data:")) continue;
      const p = s.slice(5).trim();
      if (!p) continue;
      const now = (performance.now() - t0) / 1000;
      if (firstByte === null) firstByte = now;
      let e;
      try {
        e = JSON.parse(p);
      } catch {
        // chemin Hive chat = texte brut, pas du JSON
        if (firstText === null) firstText = now;
        textChars += p.length;
        continue;
      }
      const t = e.type;
      if (t === "text_delta" || t === "llm_token") {
        if (firstText === null && (e.delta || "").trim()) firstText = now;
        textChars += (e.delta || "").length;
      } else if (t === "run_cost") {
        cost = e.cost_usd;
        tin = e.input_tokens;
        tout = e.output_tokens;
      } else {
        marks.push([now, t, (e.message || e.mode || e.error || "").slice(0, 48)]);
      }
    }
  };
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      ev(buf.slice(0, i));
      buf = buf.slice(i + 2);
    }
  }
  if (buf) ev(buf);
  const total = (performance.now() - t0) / 1000;
  console.log(`  ── ${label} ──`);
  for (const [ts, t, m] of marks) console.log(`     [+${ts.toFixed(2)}s] ${t} ${m}`);
  console.log(`     1er event SSE : ${firstByte != null ? firstByte.toFixed(2) + "s" : "—"}`);
  console.log(`     1er token texte: ${firstText != null ? firstText.toFixed(2) + "s" : "JAMAIS"}`);
  console.log(`     total          : ${total.toFixed(2)}s`);
  console.log(`     texte chars    : ${textChars}`);
  console.log(`     cost / tokens  : ${cost} | ${tin}/${tout}`);
}

async function pathHelmDirect() {
  console.log("\n════ A. HELM DIRECT (:4102/api/orchestrate) ════");
  const t0 = performance.now();
  const res = await fetch(`${HELM}/api/orchestrate`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${HELM_TOK}`,
      "content-type": "application/json",
      accept: "text/event-stream",
      origin: HELM,
      "x-hive-tenant-id": uuid(),
      "x-hive-user-id": uuid(),
    },
    body: JSON.stringify({ message: MSG, surface: "hive-chat", conversation_id: uuid() }),
  });
  await measureSSE("orchestrate", res, t0);
}

async function pathHiveProxy() {
  console.log("\n════ B. PROXY HIVE COMPLET (:3031/api/cockpit-chat) ════");
  const token = await forgeHiveToken();
  const t0 = performance.now();
  const res = await fetch(`${HIVE}/api/cockpit-chat`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: `hive_token=${token}` },
    body: JSON.stringify({ message: MSG, messages: [{ role: "user", content: MSG }] }),
  });
  await measureSSE("cockpit-chat", res, t0);
}

const which = process.argv[2] || "both";
if (which === "helm" || which === "both") await pathHelmDirect();
if (which === "hive" || which === "both") await pathHiveProxy();
console.log("");
