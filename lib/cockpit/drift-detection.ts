/**
 * Drift Detection — analyse l'évolution des outputs entre runs successifs d'une
 * mission planifiée. Si les N derniers runs ne bougent pas (delta < threshold),
 * on suspecte que la mission n'est plus pertinente et on remonte une suggestion
 * éditoriale FR au cockpit (badge + notif in-app).
 *
 * Stratégie de comparaison :
 *   - Outputs JSON normalisés en "leaves" (chemin → valeur scalaire).
 *   - Champs numériques : variation relative (|a-b| / max(|a|,|b|,1)).
 *   - Champs string : hash equality (sha256 16-char prefix).
 *   - Champs booléens / null : equality stricte.
 *   - Pondération : un run est "stale" si la moyenne des deltas relatifs
 *     numériques + le ratio de strings inchangées dépasse 1 - thresholdPercent.
 *
 * Fail-soft :
 *   - Pas de runs précédents → consecutiveStaleRuns = 0.
 *   - Outputs structurellement incompatibles (clés très divergentes) → 0.
 *   - Output vide ou absent → 0.
 */

import { createHash } from "node:crypto";
import { KIMI_MODELS } from "@/lib/llm/models";
import { chatWithCircuitBreaker } from "@/lib/llm/safe-chat";
import { getServerSupabase } from "@/lib/platform/db/supabase";

// ── Types ──────────────────────────────────────────────────

export interface DriftAnalysis {
  missionId: string;
  /** Nombre de runs consécutifs (les plus récents) sans changement significatif. */
  consecutiveStaleRuns: number;
  /** ISO timestamp du dernier run où un changement a été détecté. */
  lastChangeAt: string | null;
  /** Narration FR ≤140ch, prête pour notification ou tooltip. */
  suggestion: string;
}

export interface AnalyzeDriftOptions {
  /** Seuil de "non-changement". Défaut 0.05 → un delta < 5 % compte comme stale. */
  thresholdPercent?: number;
  /** Combien de runs minimum doivent être stale pour déclencher l'alerte. Défaut 3. */
  minStaleRuns?: number;
  /** Fenêtre de runs à examiner. Défaut 6 (3 stale + 3 historiques). */
  windowSize?: number;
}

interface RunRow {
  id: string;
  output: unknown;
  status: string;
  finished_at: string | null;
  created_at: string;
}

// ── Public API ─────────────────────────────────────────────

/**
 * Compare les outputs des N derniers runs d'une mission.
 * Retourne une analyse contenant le compteur de runs stales consécutifs et
 * une suggestion FR cliente prête à servir de body de notification.
 */
export async function analyzeMissionDrift(
  missionId: string,
  opts: AnalyzeDriftOptions = {},
): Promise<DriftAnalysis> {
  const threshold = clampThreshold(opts.thresholdPercent ?? 0.05);
  const minStale = Math.max(2, opts.minStaleRuns ?? 3);
  const windowSize = Math.max(minStale + 1, opts.windowSize ?? 6);

  const empty: DriftAnalysis = {
    missionId,
    consecutiveStaleRuns: 0,
    lastChangeAt: null,
    suggestion: "",
  };

  const sb = getServerSupabase();
  if (!sb) return empty;

  const { data, error } = await sb
    .from("runs")
    // Cast en `any` car la colonne `output` a été ajoutée par migration
    // hors database.types et la signature stricte ne la connaît pas.
    .select("id, output, status, finished_at, created_at")
    // Match `metadata->>missionId` (denormalisation v2 dans le JSONB metadata).
    .filter("metadata->>missionId", "eq", missionId)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(windowSize);

  if (error || !Array.isArray(data) || data.length < 2) return empty;

  const runs = (data as unknown as RunRow[]).filter(
    (r) => r.output !== null && r.output !== undefined,
  );
  if (runs.length < 2) return empty;

  // On parcourt les runs du plus récent vers les plus anciens. Tant qu'un
  // delta consécutif (newest vs previous, previous vs prev-prev, …) reste
  // sous le seuil, on incrémente. Au premier delta franc on arrête.
  let stale = 0;
  let lastChangeIso: string | null = null;
  for (let i = 0; i < runs.length - 1; i++) {
    const a = runs[i];
    const b = runs[i + 1];
    const delta = computeDelta(a.output, b.output);
    if (delta === null) {
      // Outputs incompatibles : on ne peut pas conclure → considéré comme
      // changement significatif (fail-soft, on évite les faux positifs).
      lastChangeIso = a.finished_at ?? a.created_at;
      break;
    }
    if (delta < threshold) {
      stale++;
    } else {
      lastChangeIso = a.finished_at ?? a.created_at;
      break;
    }
  }

  if (stale < minStale) {
    return {
      missionId,
      consecutiveStaleRuns: stale,
      lastChangeAt: lastChangeIso,
      suggestion: "",
    };
  }

  return {
    missionId,
    consecutiveStaleRuns: stale,
    lastChangeAt: lastChangeIso,
    // La suggestion finale est résolue par `generateDriftNarration` côté
    // appelant pour pouvoir y injecter le titre de mission + cache Haiku.
    suggestion: defaultDriftLine(stale),
  };
}

// ── Narration Haiku ────────────────────────────────────────

const HAIKU_MODEL = KIMI_MODELS.HAIKU;
const NARRATION_TTL_MS = 60 * 60_000; // 1 h
const MAX_LEN = 140;

interface NarrationCacheEntry {
  text: string;
  expiresAt: number;
}

const narrationCache = new Map<string, NarrationCacheEntry>();

/**
 * Produit une narration FR ≤140ch suggérant à l'user de re-évaluer la mission.
 * Cache 1h par (missionTitle + staleRuns) pour éviter des calls Haiku répétés.
 */
export async function generateDriftNarration(
  missionTitle: string,
  staleRuns: number,
): Promise<string> {
  const safeTitle = (missionTitle ?? "").trim() || "Cette mission";
  const cacheKey = `${safeTitle}::${staleRuns}`;

  const cached = narrationCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.text;

  const fallback = clipFr(
    `${safeTitle} n'a pas changé depuis ${staleRuns} runs. Toujours pertinente ?`,
  );

  const text = await chatWithCircuitBreaker<string>({
    context: "drift-detection/narration",
    chatRequest: {
      model: HAIKU_MODEL,
      max_tokens: 120,
      messages: [
        {
          role: "system",
          content: [
            "Tu es l'assistant cockpit d'un founder. Style sobre, voix régulière FR.",
            "Tu produis UNE phrase ≤140 caractères qui suggère que la mission semble figée et invite à la re-évaluer.",
            "Pas d'emoji, pas de guillemets, pas de point d'exclamation. Pas de liste.",
            "Mentionne le nom de la mission tel quel et le nombre de runs sans mouvement.",
          ].join(" "),
        },
        {
          role: "user",
          content: [
            `Mission : ${safeTitle}`,
            `Runs consécutifs sans mouvement : ${staleRuns}`,
            "Écris la phrase maintenant.",
          ].join("\n"),
        },
      ],
    },
    fallback,
    parse: (res) => {
      const cleaned = clipFr(res.content);
      return cleaned.length === 0 ? fallback : cleaned;
    },
  });

  narrationCache.set(cacheKey, { text, expiresAt: Date.now() + NARRATION_TTL_MS });
  return text;
}

// ── Comparaison structurelle ───────────────────────────────

type Leaf = { path: string; value: unknown };

/**
 * Calcule un score de delta ∈ [0, 1] entre deux outputs.
 *   - 0 = identique.
 *   - 1 = aucune intersection comparable.
 *   - null = signatures structurelles incompatibles, comparaison rejetée.
 */
function computeDelta(a: unknown, b: unknown): number | null {
  if (a === null || a === undefined || b === null || b === undefined) return null;
  if (typeof a !== "object" || typeof b !== "object") {
    return scalarsEqual(a, b) ? 0 : 1;
  }

  const leavesA = flatten(a, "");
  const leavesB = flatten(b, "");
  if (leavesA.length === 0 || leavesB.length === 0) return null;

  const mapB = new Map(leavesB.map((l) => [l.path, l.value]));
  let comparable = 0;
  let totalDelta = 0;

  for (const la of leavesA) {
    if (!mapB.has(la.path)) continue;
    comparable++;
    totalDelta += leafDelta(la.value, mapB.get(la.path));
  }

  if (comparable === 0) return null;

  // Pénalité légère pour clés ajoutées/retirées (changement de schéma = drift faible).
  const overlap = comparable / Math.max(leavesA.length, leavesB.length);
  if (overlap < 0.5) return null;

  return totalDelta / comparable;
}

function flatten(value: unknown, prefix: string): Leaf[] {
  if (value === null || value === undefined) return [{ path: prefix || "$", value }];
  if (typeof value !== "object") return [{ path: prefix || "$", value }];

  if (Array.isArray(value)) {
    // Sur des arrays, on hash le contenu agrégé pour éviter d'exploser le coût
    // (un report avec 200 lignes ne doit pas générer 200 leaves).
    return [{ path: prefix || "$", value: hashStable(value) }];
  }

  const out: Leaf[] = [];
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k;
    out.push(...flatten(v, path));
  }
  return out;
}

function leafDelta(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") {
    if (!Number.isFinite(a) || !Number.isFinite(b)) return scalarsEqual(a, b) ? 0 : 1;
    const denom = Math.max(Math.abs(a), Math.abs(b), 1);
    return Math.min(1, Math.abs(a - b) / denom);
  }
  if (typeof a === "string" && typeof b === "string") {
    return a === b ? 0 : 1;
  }
  return scalarsEqual(a, b) ? 0 : 1;
}

function scalarsEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === "number" && typeof b === "number") {
    return Number.isFinite(a) && Number.isFinite(b) && a === b;
  }
  return false;
}

function hashStable(value: unknown): string {
  try {
    return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
  } catch {
    return "unhashable";
  }
}

// ── Helpers ────────────────────────────────────────────────

function clampThreshold(v: number): number {
  if (!Number.isFinite(v)) return 0.05;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

function defaultDriftLine(staleRuns: number): string {
  return clipFr(`Mission stable depuis ${staleRuns} runs — toujours pertinente ?`);
}

function clipFr(text: string): string {
  const trimmed = (text ?? "").trim().replace(/\s+/g, " ");
  if (trimmed.length <= MAX_LEN) return trimmed;
  return `${trimmed.slice(0, MAX_LEN - 1).trimEnd()}…`;
}
