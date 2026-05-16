/**
 * Admin Health API — Architecture Finale
 *
 * System health monitoring with real checks.
 * Path: lib/admin/health.ts
 *
 * Exporte deux APIs distinctes :
 *   1. `getSystemHealth(db)` — health interne (DB, storage, connectors, LLM)
 *      consommé par /api/admin/health et le dashboard admin index.
 *   2. `getServicesHealth()` — sonde tous les services externes (LLM, Search,
 *      Media, Storage, Cache, Jobs, Observability) basée sur env vars + ping
 *      léger quand possible. Consommé par /api/admin/health/services et la
 *      page /admin/health.
 *
 * Note : la logique de ping reproduit volontairement scripts/health-check.ts
 * (qui reste la "vérité" CLI) sans le casser, en l'adaptant au format dashboard.
 * Stream D : PDL inclus (decision = gardé, 1 call site actif). Hume reste TODO.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { StorageProvider } from "../engine/runtime/assets/storage/types";

export interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  checks: {
    database: boolean;
    storage: boolean;
    connectors: boolean;
    llm: boolean;
    cache?: boolean;
  };
  latency: {
    database: number;
    storage: number;
    llm?: number;
    cache?: number;
  };
  details: {
    database?: string;
    storage?: string;
    connectors?: string;
    llm?: string;
    cache?: string;
  };
  timestamp: string;
  version: string;
}

/**
 * Get comprehensive system health
 */
export async function getSystemHealth(
  db: SupabaseClient,
  storage?: StorageProvider,
  options?: {
    checkLLM?: boolean;
    checkCache?: boolean;
  },
): Promise<HealthStatus> {
  const checks: HealthStatus["checks"] = {
    database: false,
    storage: false,
    connectors: false,
    llm: false,
  };
  const latency: HealthStatus["latency"] = {
    database: 0,
    storage: 0,
  };
  const details: HealthStatus["details"] = {};

  // 1. Database health check
  const dbHealth = await checkDatabaseHealth(db);
  checks.database = dbHealth.ok;
  latency.database = dbHealth.latencyMs;
  if (!dbHealth.ok) {
    details.database = dbHealth.error || "Database check failed";
  }

  // 2. Storage health check
  if (storage) {
    const storageHealth = await checkStorageHealth(storage);
    checks.storage = storageHealth.ok;
    latency.storage = storageHealth.latencyMs;
    if (!storageHealth.ok) {
      details.storage = storageHealth.error || "Storage check failed";
    }
  } else {
    checks.storage = true; // No storage configured = OK
    latency.storage = 0;
  }

  // 3. Connectors health (basic query check)
  const connectorsHealth = await checkConnectorsHealth(db);
  checks.connectors = connectorsHealth.ok;
  if (!connectorsHealth.ok) {
    details.connectors = connectorsHealth.error;
  }

  // 4. LLM health (optional)
  if (options?.checkLLM) {
    const llmHealth = await checkLLMHealth();
    checks.llm = llmHealth.ok;
    latency.llm = llmHealth.latencyMs;
    if (!llmHealth.ok) {
      details.llm = llmHealth.error;
    }
  } else {
    checks.llm = true; // Not checked = OK
  }

  // Determine overall status
  const failedChecks = Object.values(checks).filter((v) => !v).length;
  const status: HealthStatus["status"] =
    failedChecks === 0 ? "healthy" : failedChecks === 1 ? "degraded" : "unhealthy";

  return {
    status,
    checks,
    latency,
    details,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "unknown",
  };
}

/**
 * Check database connectivity and performance
 */
async function checkDatabaseHealth(
  db: SupabaseClient,
): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();

  try {
    // Simple health check query
    const { error } = await db
      .from("system_settings")
      .select("count", { count: "exact", head: true });

    const latencyMs = Date.now() - start;

    if (error) {
      return {
        ok: false,
        latencyMs,
        error: `Database query failed: ${error.message}`,
      };
    }

    return { ok: true, latencyMs };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : "Unknown database error",
    };
  }
}

/**
 * Check storage provider health
 */
async function checkStorageHealth(
  storage: StorageProvider,
): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();

  try {
    const result = await storage.health();
    return {
      ok: result.ok,
      latencyMs: result.latencyMs,
      error: result.error,
    };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : "Storage health check failed",
    };
  }
}

/**
 * Check connectors subsystem health
 */
async function checkConnectorsHealth(db: SupabaseClient): Promise<{ ok: boolean; error?: string }> {
  try {
    // Check if we can query integration_connections
    const { error } = await db
      .from("integration_connections")
      .select("count", { count: "exact", head: true });

    if (error) {
      return { ok: false, error: `Connectors query failed: ${error.message}` };
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Connectors check failed",
    };
  }
}

/**
 * Check LLM providers health
 */
async function checkLLMHealth(): Promise<{
  ok: boolean;
  latencyMs: number;
  error?: string;
}> {
  const start = Date.now();

  try {
    // Check Kimi API (primary provider)
    const apiKey = process.env.KIMI_API_KEY;
    if (!apiKey) {
      return {
        ok: false,
        latencyMs: 0,
        error: "KIMI_API_KEY not configured",
      };
    }

    // Simple auth check (not actual API call to avoid costs)
    const hasValidKey = apiKey.startsWith("sk-") && apiKey.length > 20;

    if (!hasValidKey) {
      return {
        ok: false,
        latencyMs: 0,
        error: "Invalid KIMI_API_KEY format",
      };
    }

    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : "LLM check failed",
    };
  }
}

// ===========================================================================
// Services Health — dashboard /admin/health
// ===========================================================================

/**
 * Statut normalisé pour le dashboard :
 *   - "ok"             : env var présente + ping API < seuil dégradé
 *   - "degraded"       : ping a répondu mais lent (> DEGRADED_LATENCY_MS) ou
 *                        HTTP non-200 acceptable (401/405 = clé valide,
 *                        service up)
 *   - "down"           : timeout, erreur réseau ou HTTP 5xx
 *   - "not_configured" : env var absente — service simplement pas activé
 */
export type ServiceStatus = "ok" | "degraded" | "down" | "not_configured";

/** Catégorie pour grouper les services dans l'UI. */
export type ServiceCategory =
  | "llm"
  | "database"
  | "storage"
  | "cache"
  | "jobs"
  | "search"
  | "media"
  | "doc"
  | "lead"
  | "email"
  | "observability"
  | "security"
  | "connectors";

export interface ServiceCheck {
  name: string;
  category: ServiceCategory;
  status: ServiceStatus;
  latencyMs?: number;
  message?: string;
}

/** Seuil au-delà duquel un ping est considéré comme dégradé (ms). */
const DEGRADED_LATENCY_MS = 2_000;

/** Timeout par défaut pour les pings de services externes (ms). */
const PING_TIMEOUT_MS = 5_000;

/** Timeout étendu pour les services lents connus (HeyGen…). */
const PING_TIMEOUT_LONG_MS = 12_000;

interface TimedFetchResult {
  status: number | null;
  latencyMs: number;
  error: string | null;
}

/**
 * Exécute un fetch GET timé avec abort + capture d'erreur. Ne lit pas le
 * body : seulement le code HTTP. Tous les pings externes passent par ici.
 */
async function timedFetch(
  url: string,
  headers: Record<string, string> = {},
  timeoutMs = PING_TIMEOUT_MS,
  method: "GET" | "POST" = "GET",
  body?: string,
): Promise<TimedFetchResult> {
  const start = Date.now();
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      headers,
      body,
      signal: ctrl.signal,
    });
    return { status: res.status, latencyMs: Date.now() - start, error: null };
  } catch (e) {
    return {
      status: null,
      latencyMs: Date.now() - start,
      error: e instanceof Error ? e.message : String(e),
    };
  } finally {
    clearTimeout(t);
  }
}

/** Wrap un résultat de fetch en ServiceCheck normalisé. */
function fromHttp(
  name: string,
  category: ServiceCategory,
  res: TimedFetchResult,
  options: {
    /** Codes considérés comme "ok" (default: [200]). */
    okCodes?: number[];
    /** Codes considérés comme "degraded" (default: [401, 403, 405]). */
    degradedCodes?: number[];
    /** Message OK custom. */
    okMessage?: string;
  } = {},
): ServiceCheck {
  const okCodes = options.okCodes ?? [200];
  const degradedCodes = options.degradedCodes ?? [401, 403, 405];

  if (res.error) {
    return {
      name,
      category,
      status: "down",
      latencyMs: res.latencyMs,
      message: res.error,
    };
  }
  if (res.status === null) {
    return { name, category, status: "down", message: "no response" };
  }
  if (okCodes.includes(res.status)) {
    const slow = res.latencyMs > DEGRADED_LATENCY_MS;
    return {
      name,
      category,
      status: slow ? "degraded" : "ok",
      latencyMs: res.latencyMs,
      message: slow ? `slow (${res.latencyMs}ms)` : options.okMessage,
    };
  }
  if (degradedCodes.includes(res.status)) {
    return {
      name,
      category,
      status: "degraded",
      latencyMs: res.latencyMs,
      message: `HTTP ${res.status} (clé probable valide)`,
    };
  }
  if (res.status >= 500) {
    return {
      name,
      category,
      status: "down",
      latencyMs: res.latencyMs,
      message: `HTTP ${res.status}`,
    };
  }
  // 4xx hors degradedCodes : on remonte en degraded plutôt que down (l'API
  // répond, le service est up — c'est la requête qui est invalide).
  return {
    name,
    category,
    status: "degraded",
    latencyMs: res.latencyMs,
    message: `HTTP ${res.status}`,
  };
}

function notConfigured(name: string, category: ServiceCategory): ServiceCheck {
  return { name, category, status: "not_configured", message: "env var absente" };
}

// ── Checks par service ─────────────────────────────────────────────────────
// Reproduction adaptée de scripts/health-check.ts. NE PAS toucher au script
// CLI : il reste la vérité source pour `npm run health`.

async function checkKimi(): Promise<ServiceCheck> {
  const key = process.env.KIMI_API_KEY;
  if (!key) return notConfigured("Kimi", "llm");
  const res = await timedFetch("https://api.hypercli.com/v1/models", {
    Authorization: `Bearer ${key}`,
  });
  return fromHttp("Kimi", "llm", res, { okMessage: "models endpoint" });
}

async function checkOpenAI(): Promise<ServiceCheck> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return notConfigured("OpenAI", "llm");
  const res = await timedFetch("https://api.openai.com/v1/models", {
    Authorization: `Bearer ${key}`,
  });
  return fromHttp("OpenAI", "llm", res, { okMessage: "models endpoint" });
}

async function checkGemini(): Promise<ServiceCheck> {
  // Gemini = clé Google. Pas d'endpoint /models gratuit fiable, on se
  // contente du presence check.
  const key = process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!key) return notConfigured("Gemini", "llm");
  return {
    name: "Gemini",
    category: "llm",
    status: "ok",
    message: "clé présente (ping skip — pas d'endpoint gratuit fiable)",
  };
}

async function checkDeepseek(): Promise<ServiceCheck> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return notConfigured("DeepSeek", "llm");
  const res = await timedFetch("https://api.deepseek.com/v1/models", {
    Authorization: `Bearer ${key}`,
  });
  return fromHttp("DeepSeek", "llm", res);
}

async function checkSupabaseDb(): Promise<ServiceCheck> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return notConfigured("Supabase DB", "database");
  const res = await timedFetch(`${url}/rest/v1/`, {
    apikey: key,
    Authorization: `Bearer ${key}`,
  });
  return fromHttp("Supabase DB", "database", res, {
    okCodes: [200, 404],
    okMessage: "REST endpoint reachable",
  });
}

async function checkSupabaseStorageBucket(): Promise<ServiceCheck> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return notConfigured("Supabase Storage", "storage");
  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "assets";
  const res = await timedFetch(`${url}/storage/v1/bucket/${bucket}`, {
    apikey: key,
    Authorization: `Bearer ${key}`,
  });
  return fromHttp("Supabase Storage", "storage", res, {
    okMessage: `bucket=${bucket}`,
  });
}

async function checkUpstashRest(): Promise<ServiceCheck> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return notConfigured("Upstash (REST)", "cache");
  const res = await timedFetch(`${url}/ping`, {
    Authorization: `Bearer ${token}`,
  });
  return fromHttp("Upstash (REST)", "cache", res, { okMessage: "PONG" });
}

async function checkRedisQueue(): Promise<ServiceCheck> {
  const url = process.env.REDIS_URL;
  if (!url) return notConfigured("Redis (BullMQ)", "jobs");
  if (!/^rediss?:\/\//.test(url)) {
    return {
      name: "Redis (BullMQ)",
      category: "jobs",
      status: "down",
      message: "URL malformée (attendu redis:// ou rediss://)",
    };
  }
  return {
    name: "Redis (BullMQ)",
    category: "jobs",
    status: "ok",
    message: "URL valide (ping TCP skip — ioredis requis)",
  };
}

async function checkInngestJobs(): Promise<ServiceCheck> {
  const eventKey = process.env.INNGEST_EVENT_KEY;
  const signingKey = process.env.INNGEST_SIGNING_KEY;
  if (!eventKey || !signingKey) return notConfigured("Inngest", "jobs");
  const res = await timedFetch(`https://inn.gs/e/${eventKey}`, {});
  return fromHttp("Inngest", "jobs", res, {
    okCodes: [200, 400, 405],
  });
}

async function checkExa(): Promise<ServiceCheck> {
  const key = process.env.EXA_API_KEY;
  if (!key) return notConfigured("Exa", "search");
  const res = await timedFetch(
    "https://api.exa.ai/search",
    { "x-api-key": key, "Content-Type": "application/json" },
    PING_TIMEOUT_MS,
    "POST",
    JSON.stringify({ query: "ping", numResults: 1 }),
  );
  return fromHttp("Exa", "search", res);
}

async function checkTavily(): Promise<ServiceCheck> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return notConfigured("Tavily", "search");
  const res = await timedFetch(
    "https://api.tavily.com/search",
    { "Content-Type": "application/json" },
    PING_TIMEOUT_MS,
    "POST",
    JSON.stringify({ api_key: key, query: "ping", max_results: 1 }),
  );
  return fromHttp("Tavily", "search", res);
}

async function checkPerplexity(): Promise<ServiceCheck> {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) return notConfigured("Perplexity", "search");
  const res = await timedFetch("https://api.perplexity.ai/chat/completions", {
    Authorization: `Bearer ${key}`,
  });
  return fromHttp("Perplexity", "search", res, {
    okCodes: [200, 400, 405],
    okMessage: "clé valide (méthode GET refusée mais service up)",
  });
}

async function checkFal(): Promise<ServiceCheck> {
  const key = process.env.FAL_KEY;
  if (!key) return notConfigured("FAL.ai", "media");
  const res = await timedFetch("https://queue.fal.run/", {
    Authorization: `Key ${key}`,
  });
  return fromHttp("FAL.ai", "media", res, {
    okCodes: [200, 404],
    degradedCodes: [401, 403, 405],
  });
}

async function checkElevenLabs(): Promise<ServiceCheck> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return notConfigured("ElevenLabs", "media");
  const res = await timedFetch("https://api.elevenlabs.io/v1/user", {
    "xi-api-key": key,
  });
  return fromHttp("ElevenLabs", "media", res, { okMessage: "user endpoint" });
}

async function checkHeyGen(): Promise<ServiceCheck> {
  const key = process.env.HEYGEN_API_KEY;
  if (!key) return notConfigured("HeyGen", "media");
  const res = await timedFetch(
    "https://api.heygen.com/v1/voice.list",
    { "X-Api-Key": key },
    PING_TIMEOUT_LONG_MS,
  );
  return fromHttp("HeyGen", "media", res);
}

async function checkRunway(): Promise<ServiceCheck> {
  const key = process.env.RUNWAY_API_KEY;
  if (!key) return notConfigured("Runway", "media");
  // /v1/organization = endpoint info gratuit (pas de génération)
  const res = await timedFetch("https://api.dev.runwayml.com/v1/organization", {
    Authorization: `Bearer ${key}`,
    "X-Runway-Version": "2024-11-06",
  });
  return fromHttp("Runway", "media", res);
}

async function checkDeepgram(): Promise<ServiceCheck> {
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) return notConfigured("Deepgram", "media");
  const res = await timedFetch("https://api.deepgram.com/v1/projects", {
    Authorization: `Token ${key}`,
  });
  return fromHttp("Deepgram", "media", res);
}

async function checkRecall(): Promise<ServiceCheck> {
  const key = process.env.RECALL_API_KEY;
  if (!key) return notConfigured("Recall.ai", "media");
  const base = process.env.RECALL_API_BASE ?? "https://us-east-1.recall.ai";
  const res = await timedFetch(`${base}/api/v1/bot/`, {
    Authorization: `Token ${key}`,
  });
  return fromHttp("Recall.ai", "media", res);
}

async function checkLlamaParse(): Promise<ServiceCheck> {
  const key = process.env.LLAMA_CLOUD_API_KEY;
  if (!key) return notConfigured("LlamaParse", "doc");
  const res = await timedFetch("https://api.cloud.llamaindex.ai/api/v1/parsing/job/health", {
    Authorization: `Bearer ${key}`,
  });
  return fromHttp("LlamaParse", "doc", res);
}

async function checkE2B(): Promise<ServiceCheck> {
  const key = process.env.E2B_API_KEY;
  if (!key) return notConfigured("E2B", "doc");
  const res = await timedFetch("https://api.e2b.dev/sandboxes", {
    "X-API-KEY": key,
  });
  return fromHttp("E2B", "doc", res);
}

async function checkBrowserbase(): Promise<ServiceCheck> {
  const key = process.env.BROWSERBASE_API_KEY;
  const projectId = process.env.BROWSERBASE_PROJECT_ID;
  if (!key) return notConfigured("Browserbase", "doc");
  if (!projectId) {
    return {
      name: "Browserbase",
      category: "doc",
      status: "degraded",
      message: "BROWSERBASE_PROJECT_ID manquant",
    };
  }
  const res = await timedFetch(`https://api.browserbase.com/v1/projects/${projectId}`, {
    "x-bb-api-key": key,
  });
  return fromHttp("Browserbase", "doc", res);
}

async function checkApollo(): Promise<ServiceCheck> {
  const key = process.env.APOLLO_API_KEY;
  if (!key) return notConfigured("Apollo", "lead");
  const res = await timedFetch("https://api.apollo.io/v1/auth/health", {
    "X-Api-Key": key,
    "Content-Type": "application/json",
  });
  return fromHttp("Apollo", "lead", res);
}

async function checkPdl(): Promise<ServiceCheck> {
  // PDL facture chaque appel (pas d'endpoint /me ou /usage gratuit). On se
  // contente du presence check — Stream D a confirmé 1 call site actif
  // (lib/tools/native/enrich.ts via enrichCompany).
  const key = process.env.PDL_API_KEY;
  if (!key) return notConfigured("PDL", "lead");
  return {
    name: "PDL",
    category: "lead",
    status: "ok",
    message: "clé présente (ping skip — endpoints PDL payants)",
  };
}

async function checkResend(): Promise<ServiceCheck> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return notConfigured("Resend", "email");
  const res = await timedFetch("https://api.resend.com/domains", {
    Authorization: `Bearer ${key}`,
  });
  return fromHttp("Resend", "email", res);
}

async function checkSentry(): Promise<ServiceCheck> {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return notConfigured("Sentry", "observability");
  const match = dsn.match(/^https:\/\/[^@]+@([^/]+)\/(\d+)$/);
  if (!match) {
    return {
      name: "Sentry",
      category: "observability",
      status: "down",
      message: "DSN malformé",
    };
  }
  const host = match[1];
  const res = await timedFetch(`https://${host}/api/0/`);
  return fromHttp("Sentry", "observability", res, {
    okCodes: [200, 401],
    okMessage: "ingest endpoint joignable",
  });
}

async function checkLangfuse(): Promise<ServiceCheck> {
  const pk = process.env.LANGFUSE_PUBLIC_KEY;
  const sk = process.env.LANGFUSE_SECRET_KEY;
  if (!pk || !sk) return notConfigured("Langfuse", "observability");
  const host = process.env.LANGFUSE_HOST ?? "https://cloud.langfuse.com";
  const auth = Buffer.from(`${pk}:${sk}`).toString("base64");
  const res = await timedFetch(`${host}/api/public/projects`, {
    Authorization: `Basic ${auth}`,
  });
  return fromHttp("Langfuse", "observability", res);
}

async function checkAxiom(): Promise<ServiceCheck> {
  const token = process.env.AXIOM_TOKEN;
  if (!token) return notConfigured("Axiom", "observability");
  const res = await timedFetch("https://api.axiom.co/v1/datasets", {
    Authorization: `Bearer ${token}`,
  });
  return fromHttp("Axiom", "observability", res);
}

async function checkArcjet(): Promise<ServiceCheck> {
  const key = process.env.ARCJET_KEY;
  if (!key) return notConfigured("Arcjet", "security");
  if (!key.startsWith("ajkey_")) {
    return {
      name: "Arcjet",
      category: "security",
      status: "down",
      message: "format key invalide (attendu ajkey_…)",
    };
  }
  return {
    name: "Arcjet",
    category: "security",
    status: "ok",
    message: "format key OK (décisions au runtime edge)",
  };
}

async function checkComposio(): Promise<ServiceCheck> {
  const key = process.env.COMPOSIO_API_KEY;
  if (!key) return notConfigured("Composio", "connectors");
  const res = await timedFetch("https://backend.composio.dev/api/v3/internal/sdk/auth/health", {
    "x-api-key": key,
  });
  return fromHttp("Composio", "connectors", res);
}

// Stream D : PDL gardé (1 call site actif via enrichCompany). Hume reste TODO.

/**
 * Liste ordonnée des checks. L'ordre dicte l'affichage du dashboard quand
 * on n'a pas de tri secondaire.
 */
const SERVICE_CHECKS: Array<() => Promise<ServiceCheck>> = [
  // LLM
  checkKimi,
  checkOpenAI,
  checkGemini,
  checkDeepseek,
  // Database + Storage
  checkSupabaseDb,
  checkSupabaseStorageBucket,
  // Jobs & Cache
  checkUpstashRest,
  checkRedisQueue,
  checkInngestJobs,
  // Search
  checkExa,
  checkTavily,
  checkPerplexity,
  // Media
  checkFal,
  checkElevenLabs,
  checkHeyGen,
  checkRunway,
  checkDeepgram,
  checkRecall,
  // Doc / Code
  checkLlamaParse,
  checkE2B,
  checkBrowserbase,
  // Lead
  checkApollo,
  checkPdl,
  // Email
  checkResend,
  // Observability
  checkSentry,
  checkLangfuse,
  checkAxiom,
  // Security
  checkArcjet,
  // Connectors
  checkComposio,
];

export interface ServicesHealthReport {
  checkedAt: string;
  services: ServiceCheck[];
  summary: {
    ok: number;
    degraded: number;
    down: number;
    notConfigured: number;
    total: number;
  };
}

/**
 * Exécute tous les checks de services externes en parallèle. Tolérant : si
 * un check throw inopinément, on le convertit en "down" plutôt que de
 * propager. Le dashboard doit toujours rendre un état complet.
 */
export async function getServicesHealth(): Promise<ServicesHealthReport> {
  const settled = await Promise.allSettled(SERVICE_CHECKS.map((c) => c()));

  const services: ServiceCheck[] = settled.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    return {
      name: SERVICE_CHECKS[i].name.replace(/^check/, "") || "Service",
      category: "llm",
      status: "down",
      message: r.reason instanceof Error ? r.reason.message : String(r.reason),
    };
  });

  const summary = {
    ok: services.filter((s) => s.status === "ok").length,
    degraded: services.filter((s) => s.status === "degraded").length,
    down: services.filter((s) => s.status === "down").length,
    notConfigured: services.filter((s) => s.status === "not_configured").length,
    total: services.length,
  };

  return {
    checkedAt: new Date().toISOString(),
    services,
    summary,
  };
}
