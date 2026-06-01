/**
 * Cortex capability resolver.
 *
 * Resolve la surface tools autorisée depuis Cortex à partir d'un `contextId`
 * (ex: "adrien"), sans dépendre d'une allowlist hardcodée côté client.
 *
 * Sécurité :
 * - Header obligatoire `x-cortex-tenant-id`
 * - Mapping runtime/slug → tools Helm strictement contrôlé
 * - Les champs "risk" renvoyés par le client Cortex ne sont JAMAIS utilisés
 * - Sur erreur HTTP/réseau, on retourne un résultat contrôlé (tools vides)
 */

import { createHmac } from "node:crypto";
import { logger } from "@/lib/observability/logger";
import { redactId } from "@/lib/utils/redact";

const CORTEX_CAPABILITY_ENDPOINT = "/api/capabilities/resolve";
const TIMEOUT_MS = 2_500;

// JWT Cortex — même contrat que le client mémoire (iss/aud/algo).
const CORTEX_JWT_ISS = "cortex";
const CORTEX_JWT_AUD = "cortex.hearst.app";
const CORTEX_JWT_TTL_S = 300;

/**
 * Mapping capability Cortex (slug canonique) -> tools Helm réellement exposables.
 *
 * Une capability Cortex peut exposer PLUSIEURS tools Helm (ex: `gmail` =
 * fetch + send). On ne mappe QUE les capabilities dont Helm possède une
 * implémentation réelle dans le toolset agent (`lib/engine/orchestrator/ai-pipeline.ts`).
 * Les capabilities sans tool Helm (shell, supabase_sql, file, redis, vercel,
 * cloudflare, git, github, posthog, deepseek, helm_call) restent volontairement
 * NON mappées — on ne faux-expose jamais un tool inexistant.
 */
const CAPABILITY_TO_HELM_TOOLS: Record<string, string[]> = {
  // RAG / mémoire
  cortex_search: ["cortex_search"],
  memory: ["cortex_search", "query_knowledge_graph"],
  // Mail / Drive (Google natif)
  gmail: ["gmail_fetch_emails", "gmail_send_email"],
  drive: ["googledrive_list_files"],
  // Web
  web: ["web_search"],
  // Génération média
  image: ["generate_image"],
  tts: ["generate_audio"],
  // Exécution code (sandbox E2B)
  sandbox: ["run_code"],
  // Communication (Resend)
  email: ["send_email"],
  // Observabilité
  sentry: ["query_sentry_issues"],
  axiom: ["query_axiom_logs"],
  langfuse: ["query_langfuse_traces"],
  // Jobs / events
  inngest: ["schedule_inngest_job"],
  // Browser
  browser: ["start_browser"],
};

/**
 * Index runtime/slug -> tools Helm. Accepte la forme runtime
 * (`hive:tool:<slug>`) ET le slug nu, normalisés en minuscules.
 */
const CORTEX_RUNTIME_TO_HELM_TOOL: Record<string, string[]> = Object.fromEntries(
  Object.entries(CAPABILITY_TO_HELM_TOOLS).flatMap(([slug, tools]) => [
    [slug, tools] as [string, string[]],
    [`hive:tool:${slug}`, tools] as [string, string[]],
  ]),
);

type ResolveStatus = "ok" | "empty" | "error" | "skipped";

interface RawCapabilityRecord {
  runtime?: unknown;
  slug?: unknown;
}

export interface ResolveCapabilitiesResult {
  status: ResolveStatus;
  tools: string[];
  httpStatus?: number;
  reason?: string;
}

interface ResolveCapabilitiesInput {
  tenantId: string;
  contextId: string;
  userId?: string;
}

/** base64url sans padding (format JWT). */
function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function signCortexJwt(tenantId: string, userId: string): string | null {
  const secret = process.env.CORTEX_JWT_SECRET;
  if (!secret) return null;
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({
      sub: userId,
      tenant_id: tenantId,
      scope: ["read"],
      iss: CORTEX_JWT_ISS,
      aud: CORTEX_JWT_AUD,
      iat: now,
      exp: now + CORTEX_JWT_TTL_S,
    }),
  );
  const data = `${header}.${payload}`;
  const sig = b64url(createHmac("sha256", secret).update(data).digest());
  return `${data}.${sig}`;
}

function buildAuthHeaders(tenantId: string, userId: string): Record<string, string> {
  const jwt = signCortexJwt(tenantId, userId);
  if (jwt) return { Authorization: `Bearer ${jwt}` };
  const apiKey = process.env.CORTEX_PUBLIC_API_KEY;
  if (apiKey) return { "x-api-key": apiKey };
  return {};
}

function extractRecords(payload: unknown): RawCapabilityRecord[] {
  if (Array.isArray(payload)) {
    return payload.filter((v): v is RawCapabilityRecord => typeof v === "object" && v !== null);
  }
  if (!payload || typeof payload !== "object") return [];
  const obj = payload as Record<string, unknown>;
  if (Array.isArray(obj.capabilities)) {
    return obj.capabilities.filter(
      (v): v is RawCapabilityRecord => typeof v === "object" && v !== null,
    );
  }
  if (Array.isArray(obj.items)) {
    return obj.items.filter((v): v is RawCapabilityRecord => typeof v === "object" && v !== null);
  }
  if (obj.data && typeof obj.data === "object") {
    const dataObj = obj.data as Record<string, unknown>;
    if (Array.isArray(dataObj.capabilities)) {
      return dataObj.capabilities.filter(
        (v): v is RawCapabilityRecord => typeof v === "object" && v !== null,
      );
    }
    if (Array.isArray(dataObj.items)) {
      return dataObj.items.filter(
        (v): v is RawCapabilityRecord => typeof v === "object" && v !== null,
      );
    }
  }
  return [];
}

function normalizeRuntimeCandidate(value: string): string {
  return value.trim().toLowerCase();
}

function mapRecordToTools(record: RawCapabilityRecord): string[] {
  const runtimeRaw = typeof record.runtime === "string" ? record.runtime : "";
  const slugRaw = typeof record.slug === "string" ? record.slug : "";
  const runtime = normalizeRuntimeCandidate(runtimeRaw);
  const slug = normalizeRuntimeCandidate(slugRaw);

  // 1) runtime explicite (ex: hive:tool:gmail)
  if (runtime && CORTEX_RUNTIME_TO_HELM_TOOL[runtime]) {
    return CORTEX_RUNTIME_TO_HELM_TOOL[runtime];
  }

  // 2) fallback slug (ex: gmail)
  if (slug && CORTEX_RUNTIME_TO_HELM_TOOL[slug]) {
    return CORTEX_RUNTIME_TO_HELM_TOOL[slug];
  }

  return [];
}

function contextIdToFallbackUserId(contextId: string): string {
  const trimmed = contextId.trim();
  return trimmed || "cortex-context";
}

/**
 * Résout le contextId Cortex à partir de l'entity Composio (`hive:<context>`).
 * Fallback tenant UUID (aliasé côté Cortex).
 */
export function resolveCapabilityContextId(input: {
  composioEntityId?: string;
  tenantId: string;
}): string {
  const entity = input.composioEntityId?.trim();
  if (entity && entity.toLowerCase().startsWith("hive:")) {
    const raw = entity.slice("hive:".length).trim();
    if (raw.length > 0) return raw;
  }
  return input.tenantId;
}

export async function resolveCapabilities(
  input: ResolveCapabilitiesInput,
): Promise<ResolveCapabilitiesResult> {
  const baseUrl = process.env.CORTEX_URL;
  const tenantId = input.tenantId.trim();
  const contextId = input.contextId.trim();

  if (!baseUrl) {
    logger.info("[cortex-capabilities] CORTEX_URL absent — fallback legacy");
    return { status: "skipped", tools: [], reason: "missing_cortex_url" };
  }
  if (!tenantId || !contextId) {
    logger.warn(
      {
        tenant: redactId(tenantId),
        context: redactId(contextId),
      },
      "[cortex-capabilities] tenant/context manquant — fallback legacy",
    );
    return { status: "skipped", tools: [], reason: "missing_scope" };
  }

  const userId = input.userId?.trim() || contextIdToFallbackUserId(contextId);
  const authHeaders = buildAuthHeaders(tenantId, userId);
  if (Object.keys(authHeaders).length === 0) {
    logger.warn("[cortex-capabilities] auth Cortex absente — fallback legacy");
    return { status: "skipped", tools: [], reason: "missing_auth" };
  }

  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const endpoint = `${baseUrl.replace(/\/$/, "")}${CORTEX_CAPABILITY_ENDPOINT}`;
    const requestHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      "x-cortex-tenant-id": tenantId,
      ...authHeaders,
    };

    let res = await fetch(endpoint, {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify({ contextId }),
      signal: controller.signal,
    });

    // Compatibilité API : certains déploiements exposent uniquement GET.
    if (res.status === 404 || res.status === 405) {
      const qs = new URLSearchParams({ contextId });
      res = await fetch(`${endpoint}?${qs.toString()}`, {
        method: "GET",
        headers: requestHeaders,
        signal: controller.signal,
      });
    }

    if (!res.ok) {
      logger.warn(
        {
          status: res.status,
          tenant: redactId(tenantId),
          context: redactId(contextId),
        },
        "[cortex-capabilities] resolve HTTP error",
      );
      return {
        status: "error",
        tools: [],
        httpStatus: res.status,
        reason: `http_${res.status}`,
      };
    }

    const payload = (await res.json()) as unknown;
    const records = extractRecords(payload);
    const tools = [...new Set(records.flatMap((record) => mapRecordToTools(record)))];

    if (tools.length === 0) {
      logger.info(
        {
          tenant: redactId(tenantId),
          context: redactId(contextId),
          records: records.length,
        },
        "[cortex-capabilities] no mappable tool",
      );
      return { status: "empty", tools: [] };
    }

    logger.info(
      {
        tenant: redactId(tenantId),
        context: redactId(contextId),
        toolsCount: tools.length,
      },
      "[cortex-capabilities] resolved",
    );
    return { status: "ok", tools };
  } catch (err: unknown) {
    const errorName = err instanceof Error ? err.name : "UnknownError";
    logger.warn(
      {
        error: errorName,
        tenant: redactId(tenantId),
        context: redactId(contextId),
      },
      "[cortex-capabilities] resolve failed",
    );
    return { status: "error", tools: [], reason: errorName };
  } finally {
    clearTimeout(timerId);
  }
}
