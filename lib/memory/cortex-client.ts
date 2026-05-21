/**
 * cortex-client — fédération de mémoire Helm → Cortex (LTM distant).
 *
 * Interroge le vault Cortex (287k notes, BGE 384d) par TEXTE (jamais par
 * vecteur : les dimensions sont incompatibles, 1536 ≠ 384). Cortex ré-embed
 * côté serveur. Fail-soft total : toute erreur → [].
 *
 * Variables requises :
 *   CORTEX_URL             — URL de base du serveur Cortex (ex: https://cortex.hearst.app)
 *   CORTEX_PUBLIC_API_KEY  — clé d'authentification publique
 */

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
}): Promise<RetrievedEmbedding[]> {
  const baseUrl = process.env.CORTEX_URL;
  const apiKey = process.env.CORTEX_PUBLIC_API_KEY;

  if (!baseUrl || !apiKey) {
    console.warn("[cortex-client] CORTEX_URL ou CORTEX_PUBLIC_API_KEY absent — skipping");
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
        "x-api-key": apiKey,
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
