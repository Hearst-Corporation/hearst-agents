/**
 * cortex-client — fédération de mémoire Helm → Cortex (LTM distant).
 *
 * Interroge le vault Cortex (287k notes, BGE 384d) par TEXTE (jamais par
 * vecteur : les dimensions sont incompatibles, 1536 ≠ 384). Cortex ré-embed
 * côté serveur. Fail-soft total : toute erreur → [].
 *
 * Authentification (multi-tenant) :
 *   - Si tenantId fourni → JWT HS256 signé avec CORTEX_JWT_SECRET (claims
 *     {sub, tenant_id, scope}). Cortex isole alors la mémoire PAR TENANT
 *     → chaque user n'accède qu'à SA sauvegarde.
 *   - Sinon → fallback x-api-key (CORTEX_PUBLIC_API_KEY) = tenant par défaut.
 *
 * Variables :
 *   CORTEX_URL             — URL de base Cortex (ex: https://cortex.hearst.app)
 *   CORTEX_JWT_SECRET      — secret partagé HS256 (= JWT_SECRET côté Cortex) [multi-tenant]
 *   CORTEX_PUBLIC_API_KEY  — clé publique fallback (mono-tenant)
 */

import { createHmac } from "node:crypto";
import type { RetrievedEmbedding } from "@/lib/embeddings/store";

const DEFAULT_K = 5;
const MAX_K = 25;
const MIN_K = 1;
// 2.5s : marge pour un cold-start Cortex (Vercel) sans bloquer le tour de chat.
// Au-delà, fail-soft → mémoire locale seule (cf. getRetrievedMemoryForUser).
const TIMEOUT_MS = 2_500;

const CORTEX_SEARCH_ENDPOINT = "/api/search";
const CORTEX_SEARCH_MODE = "hybrid";
const CORTEX_SOURCE_TAG = "cortex_ltm";
// Segments de path identifiant une note originaire de Helm (anti-boucle C3)
const HELM_PATH_SEGMENT = "/helm/";
const HELM_PATH_PREFIX = "helm/";

// JWT Cortex — doit matcher lib/server/auth.ts côté Cortex (iss/aud/algo).
const CORTEX_JWT_ISS = "cortex";
const CORTEX_JWT_AUD = "cortex.hearst.app";
const CORTEX_JWT_TTL_S = 300;

/** base64url sans padding (format JWT). */
function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Signe un JWT HS256 compatible Cortex (verifyJwt jose : iss + aud + exp).
 * Retourne null si CORTEX_JWT_SECRET absent → le caller retombe sur x-api-key.
 */
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

interface CortexResult {
  path?: string;
  title?: string;
  score?: number;
  projet?: string;
  date?: string;
  type?: string;
  source?: string;
  content_preview?: string;
}

interface CortexResponse {
  query?: string;
  count?: number;
  results?: CortexResult[];
}

/**
 * Recherche dans Cortex LTM par texte. Retourne [] si CORTEX_URL ou
 * CORTEX_PUBLIC_API_KEY est absent, ou sur toute erreur réseau/HTTP.
 */
export async function searchCortexMemory(params: {
  query: string;
  k?: number;
  /** Tenant du user connecté → mémoire ISOLÉE par tenant (JWT). */
  tenantId?: string;
  /** User id (claim sub du JWT). */
  userId?: string;
}): Promise<RetrievedEmbedding[]> {
  const baseUrl = process.env.CORTEX_URL;

  // Auth : JWT par tenant si dispo (isolation multi-tenant), sinon x-api-key global.
  // trim() défensif : un tenantId whitespace " " signerait un JWT à tenant invalide.
  const tenantId = params.tenantId?.trim();
  const jwt = tenantId ? signCortexJwt(tenantId, params.userId?.trim() || tenantId) : null;
  const apiKey = process.env.CORTEX_PUBLIC_API_KEY;
  const authHeaders: Record<string, string> = jwt
    ? { Authorization: `Bearer ${jwt}` }
    : apiKey
      ? { "x-api-key": apiKey }
      : {};

  if (!baseUrl || Object.keys(authHeaders).length === 0) {
    console.warn("[cortex-client] CORTEX_URL ou auth (JWT/api-key) absent — skipping");
    return [];
  }

  const k = Math.max(MIN_K, Math.min(MAX_K, params.k ?? DEFAULT_K));
  const query = params.query.trim();
  if (!query) return [];

  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}${CORTEX_SEARCH_ENDPOINT}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      body: JSON.stringify({ query, limit: k, mode: CORTEX_SEARCH_MODE }),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.warn(`[cortex-client] HTTP ${res.status} — skipping`);
      return [];
    }

    const data = (await res.json()) as CortexResponse;
    const results = data.results ?? [];

    return results
      .filter((r) => {
        // ANTI-BOUCLE (C3) : exclure les points qui proviennent de Helm
        // lui-même pour éviter de réinjecter des souvenirs Helm→Cortex→Helm.
        // Les notes Helm dans Cortex sont stockées sous "00_Inbox/helm/..." OU "helm/..."
        // → double garde : segment dans le path ET source explicite.
        const pathIsHelm =
          typeof r.path === "string" &&
          (r.path.includes(HELM_PATH_SEGMENT) || r.path.startsWith(HELM_PATH_PREFIX));
        const sourceIsHelm = r.source === "helm";
        return !pathIsHelm && !sourceIsHelm;
      })
      .filter((r) => {
        // Ne conserver que les résultats avec un contenu textuel exploitable
        return !!(r.content_preview?.trim() || r.title?.trim());
      })
      .map(
        (r): RetrievedEmbedding => ({
          // "transcript" est le kind existant le plus proche d'un contenu externe brut.
          // On ne crée PAS de nouveau kind (EmbeddingSourceKind est une union FERMÉE).
          sourceKind: "transcript",
          sourceId: r.path ?? "",
          textExcerpt: r.content_preview?.trim() || r.title?.trim() || "",
          similarity: typeof r.score === "number" ? r.score : 0,
          metadata: {
            source: CORTEX_SOURCE_TAG,
            title: r.title,
            projet: r.projet,
            cortexType: r.type,
          },
          createdAt: r.date ?? new Date().toISOString(),
        }),
      );
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      console.warn(`[cortex-client] timeout ${TIMEOUT_MS}ms — skipping`);
    } else {
      console.warn(
        "[cortex-client] fetch error — skipping",
        err instanceof Error ? err.name : "unknown",
      );
    }
    return [];
  } finally {
    clearTimeout(timerId);
  }
}

// Webhook d'ingestion Cortex (HMAC HELM_WEBHOOK_SECRET) — réutilisé pour la
// fédération ÉCRITURE (le plan A-Z autorise réutiliser /api/ingest/helm).
const CORTEX_INGEST_ENDPOINT = "/api/ingest/helm";

/**
 * Pousse un tour de conversation Helm vers Cortex (fédération mémoire ÉCRITURE).
 * Cortex crée une note `source:helm` ré-indexée dans le RAG ; la LECTURE
 * (searchCortexMemory) exclut ces notes (anti-boucle C3) → pas de réinjection
 * Helm→Cortex→Helm. Auth = HMAC-SHA256 sur le body brut (HELM_WEBHOOK_SECRET,
 * partagé avec Cortex).
 *
 * Fail-soft total : CORTEX_URL/secret absent ou toute erreur → false, jamais
 * de throw. Appelé en fire-and-forget depuis kg-ingest-pipeline (throttlé 5min).
 */
export async function pushToCortexMemory(params: {
  userId: string;
  tenantId: string;
  userMessage: string;
  assistantReply: string;
}): Promise<boolean> {
  const baseUrl = process.env.CORTEX_URL;
  const secret = process.env.HELM_WEBHOOK_SECRET;
  if (!baseUrl || !secret) {
    console.warn("[cortex-client] CORTEX_URL ou HELM_WEBHOOK_SECRET absent — push skip");
    return false;
  }

  const userMessage = (params.userMessage ?? "").trim();
  const assistantReply = (params.assistantReply ?? "").trim();
  if (!userMessage && !assistantReply) return false;

  // ⚠️ La signature HMAC porte sur la string EXACTE envoyée → sérialiser une
  // seule fois et signer/poster ce même `body` (jamais re-stringify).
  const body = JSON.stringify({
    event: "memory.turn",
    timestamp: new Date().toISOString(),
    payload: {
      user_id: params.userId,
      // tenant_id transmis pour quand Cortex scopera l'ingest par tenant
      // (aujourd'hui /api/ingest/helm rattache au DEFAULT_TENANT).
      tenant_id: params.tenantId,
      source: "helm",
      user_message: userMessage.slice(0, 4000),
      assistant_reply: assistantReply.slice(0, 4000),
    },
  });
  const signature = createHmac("sha256", secret).update(body).digest("hex");

  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}${CORTEX_INGEST_ENDPOINT}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-helm-signature": signature },
      body,
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`[cortex-client] push HTTP ${res.status} — skip`);
      return false;
    }
    return true;
  } catch (err: unknown) {
    console.warn("[cortex-client] push error — skip", err instanceof Error ? err.name : "unknown");
    return false;
  } finally {
    clearTimeout(timerId);
  }
}
