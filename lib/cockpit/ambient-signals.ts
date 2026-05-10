/**
 * Ambient Signals — Whispers qualitatifs pour la PulseBar.
 *
 * Pivot v1.6 (2026-05-10, "OS humain") : remplace l'Anomaly Whisper
 * jargon-founder (MRR/ARR/HubSpot/Runway) par des signaux personnels
 * cohérents avec un OS humain. Aucune métrique financière, aucune alerte
 * agressive — c'est un whisper, pas un cri.
 *
 * Sources agrégées (chacune fail-soft via try/catch isolé) :
 *   1. Mission failed récemment      — mission en `failed` < 1h
 *   2. Connection OAuth expirée       — connection.status === "error" ou "degraded"
 *   3. Brief stale                    — inbox brief generatedAt > 6h
 *   4. Asset variant timeout          — variant `failed` avec error "timeout" < 1h
 *   5. Mission silencieuse            — mission planifiée, lastRunAt > 7j
 *
 * Cache mémoire 60s par scope. Le helper `_resetAmbientSignalsCache()`
 * permet aux tests de purger le cache entre les cas.
 */

import { getAllMissionOps } from "@/lib/engine/runtime/missions/ops-store";
import { getScheduledMissions } from "@/lib/engine/runtime/state/adapter";
import { getAllMissions as getMemoryMissions } from "@/lib/engine/runtime/missions/store";
import { getConnectionsByScope } from "@/lib/connectors/control-plane/store";
import { loadLatestInboxBrief } from "@/lib/inbox/store";
import { getServerSupabase } from "@/lib/platform/db/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AmbientSignalKind =
  | "mission_failed"
  | "oauth_expired"
  | "brief_stale"
  | "variant_timeout"
  | "mission_silent";

export type AmbientSignalSeverity = "info" | "warning";

export interface AmbientSignal {
  id: string;
  kind: AmbientSignalKind;
  /** Narration FR ≤ 140ch — voix sourde, pas d'alerte. */
  narration: string;
  /** ISO 8601 — instant de détection (utilisé pour la disparition automatique côté client). */
  detectedAt: string;
  /** Lien optionnel pour le clic — sinon le whisper ouvre le drawer notifications. */
  ctaHref?: string;
  /** Visuellement traité comme un whisper sourd, mais utilisable côté UI si besoin. */
  severity: AmbientSignalSeverity;
}

interface AmbientSignalsScope {
  userId: string;
  tenantId: string;
  workspaceId?: string;
}

const CACHE_TTL_MS = 60_000;
const RECENT_FAILURE_WINDOW_MS = 60 * 60_000; // 1h (PulseBar default)
const BRIEF_STALE_THRESHOLD_MS = 6 * 60 * 60_000; // 6h
const MISSION_SILENT_THRESHOLD_MS = 7 * 24 * 60 * 60_000; // 7j
const VARIANT_RECENT_LIMIT = 50;
const NARRATION_MAX_LENGTH = 140;

/** Fenêtre temporelle pour la collecte des signaux. */
export type AmbientSignalsRange = "1h" | "7d" | "30d" | "all";

const RANGE_TO_MS: Record<AmbientSignalsRange, number> = {
  "1h": 60 * 60_000,
  "7d": 7 * 24 * 60 * 60_000,
  "30d": 30 * 24 * 60 * 60_000,
  // "all" : effectivement illimité (fallback côté détecteurs).
  all: Number.MAX_SAFE_INTEGER,
};

interface CachedEntry {
  expiresAt: number;
  signals: AmbientSignal[];
}

const cache = new Map<string, CachedEntry>();

function cacheKey(scope: AmbientSignalsScope, range: AmbientSignalsRange): string {
  return `${scope.tenantId}:${scope.workspaceId ?? "*"}:${scope.userId}:${range}`;
}

/** Tronque une narration à NARRATION_MAX_LENGTH (incluant "…" si tronqué). */
function clampNarration(text: string): string {
  if (text.length <= NARRATION_MAX_LENGTH) return text;
  return `${text.slice(0, NARRATION_MAX_LENGTH - 1).trimEnd()}…`;
}

/** Wrapper fail-soft : log + fallback [] si la source throw. */
async function safeSource(
  label: string,
  fn: () => Promise<AmbientSignal[]>,
): Promise<AmbientSignal[]> {
  try {
    return await fn();
  } catch (err) {
    console.warn(`[ambient-signals] source "${label}" en erreur, fallback []`, err);
    return [];
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rawDb(sb: ReturnType<typeof getServerSupabase>): SupabaseClient<any> | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return sb as unknown as SupabaseClient<any> | null;
}

// ── Source 1 : missions failed récemment ───────────────────────────────────

async function detectMissionFailed(
  scope: AmbientSignalsScope,
  windowMs: number,
): Promise<AmbientSignal[]> {
  const now = Date.now();
  const opsMap = getAllMissionOps();

  // Pull les missions du scope (DB d'abord, fallback in-memory).
  let missions = await getScheduledMissions({
    userId: scope.userId,
    tenantId: scope.tenantId,
    workspaceId: scope.workspaceId,
  });

  if (missions.length === 0) {
    missions = getMemoryMissions()
      .filter(
        (m) =>
          m.userId === scope.userId &&
          m.tenantId === scope.tenantId &&
          (!scope.workspaceId || m.workspaceId === scope.workspaceId),
      )
      .map((m) => ({
        id: m.id,
        tenantId: m.tenantId,
        workspaceId: m.workspaceId,
        userId: m.userId,
        name: m.name,
        input: m.input,
        schedule: m.schedule,
        enabled: m.enabled,
        createdAt: m.createdAt,
        lastRunAt: m.lastRunAt,
        lastRunId: m.lastRunId,
        lastRunStatus: m.lastRunStatus,
        lastError: m.lastError,
      }));
  }

  const signals: AmbientSignal[] = [];
  for (const mission of missions) {
    const op = opsMap.get(mission.id);
    const status = op?.lastRunStatus ?? mission.lastRunStatus;
    const lastRunAt = op?.lastRunAt ?? mission.lastRunAt;
    if (status !== "failed") continue;
    if (!lastRunAt || now - lastRunAt > windowMs) continue;

    signals.push({
      id: `mission_failed:${mission.id}`,
      kind: "mission_failed",
      narration: clampNarration(`Mission ${mission.name} a échoué — voir`),
      // detectedAt = lastRunAt si dispo (sinon now) → timeline chronologique exacte
      // dans le SignalBoard, et le filtre TTL côté PulseBar reste cohérent.
      detectedAt: new Date(lastRunAt ?? now).toISOString(),
      ctaHref: `/missions/${mission.id}`,
      severity: "warning",
    });
  }

  return signals;
}

// ── Source 2 : OAuth expirée / dégradée ────────────────────────────────────

const PROVIDER_LABELS: Record<string, string> = {
  google: "Google Calendar",
  gmail: "Gmail",
  slack: "Slack",
  notion: "Notion",
  linear: "Linear",
  github: "GitHub",
  hubspot: "HubSpot",
  figma: "Figma",
};

function providerLabel(provider: string): string {
  return PROVIDER_LABELS[provider] ?? provider.charAt(0).toUpperCase() + provider.slice(1);
}

async function detectOauthExpired(scope: AmbientSignalsScope): Promise<AmbientSignal[]> {
  if (!scope.workspaceId) return [];
  const conns = await getConnectionsByScope({
    tenantId: scope.tenantId,
    workspaceId: scope.workspaceId,
    userId: scope.userId,
  });

  const now = Date.now();
  const signals: AmbientSignal[] = [];
  for (const conn of conns) {
    if (conn.status !== "error" && conn.status !== "degraded") continue;
    signals.push({
      id: `oauth_expired:${conn.provider}`,
      kind: "oauth_expired",
      narration: clampNarration(`Connexion ${providerLabel(conn.provider)} expirée — reconnecter`),
      detectedAt: new Date(now).toISOString(),
      ctaHref: "/apps",
      severity: "warning",
    });
  }
  return signals;
}

// ── Source 3 : brief stale ─────────────────────────────────────────────────

async function detectBriefStale(scope: AmbientSignalsScope): Promise<AmbientSignal[]> {
  const brief = await loadLatestInboxBrief(scope.userId);
  if (!brief) return [];

  const now = Date.now();
  const ageMs = now - brief.generatedAt;
  if (ageMs <= BRIEF_STALE_THRESHOLD_MS) return [];

  return [
    {
      id: "brief_stale",
      kind: "brief_stale",
      narration: "Briefing du matin pas encore régénéré — actualiser",
      // detectedAt = generatedAt + threshold (instant où le brief est devenu stale).
      detectedAt: new Date(brief.generatedAt + BRIEF_STALE_THRESHOLD_MS).toISOString(),
      ctaHref: "/inbox",
      severity: "info",
    },
  ];
}

// ── Source 4 : asset variant timeout ───────────────────────────────────────

interface VariantTimeoutRow {
  id: string;
  asset_id: string;
  status: string;
  error: string | null;
  updated_at: string;
}

interface AssetTitleRow {
  id: string;
  title: string | null;
  kind: string | null;
  provenance: Record<string, unknown> | null;
}

async function detectVariantTimeout(
  scope: AmbientSignalsScope,
  windowMs: number,
): Promise<AmbientSignal[]> {
  const sb = getServerSupabase();
  const client = rawDb(sb);
  if (!client) return [];

  const sinceIso = new Date(Date.now() - windowMs).toISOString();

  const { data: variantRows, error: variantErr } = await client
    .from("asset_variants")
    .select("id, asset_id, status, error, updated_at")
    .eq("status", "failed")
    .gte("updated_at", sinceIso)
    .order("updated_at", { ascending: false })
    .limit(VARIANT_RECENT_LIMIT);

  if (variantErr || !variantRows) return [];

  const candidates = (variantRows as VariantTimeoutRow[]).filter((row) => {
    if (!row.error) return false;
    return row.error.toLowerCase().includes("timeout");
  });
  if (candidates.length === 0) return [];

  const assetIds = Array.from(new Set(candidates.map((r) => r.asset_id)));
  const { data: assetRows } = await client
    .from("assets")
    .select("id, title, kind, provenance")
    .in("id", assetIds);

  const assetById = new Map<string, AssetTitleRow>(
    ((assetRows ?? []) as AssetTitleRow[]).map((a) => [a.id, a]),
  );

  const now = Date.now();
  const signals: AmbientSignal[] = [];
  for (const row of candidates) {
    const asset = assetById.get(row.asset_id);
    if (!asset) continue;

    // Filtre scope : provenance.tenantId / userId si présents.
    const prov = (asset.provenance ?? {}) as {
      tenantId?: string;
      workspaceId?: string;
      userId?: string;
    };
    if (prov.tenantId && prov.tenantId !== scope.tenantId) continue;
    if (scope.workspaceId && prov.workspaceId && prov.workspaceId !== scope.workspaceId) {
      continue;
    }
    if (prov.userId && prov.userId !== scope.userId) continue;

    const title = asset.title ?? "Variant";
    const updatedMs = Date.parse(row.updated_at);
    signals.push({
      id: `variant_timeout:${row.id}`,
      kind: "variant_timeout",
      narration: clampNarration(`Vidéo ${title} a expiré — réessayer`),
      detectedAt: new Date(Number.isFinite(updatedMs) ? updatedMs : now).toISOString(),
      ctaHref: `/assets/${row.asset_id}`,
      severity: "warning",
    });
  }
  return signals;
}

// ── Source 5 : mission silencieuse depuis 7j ───────────────────────────────

async function detectMissionSilent(scope: AmbientSignalsScope): Promise<AmbientSignal[]> {
  const now = Date.now();
  let missions = await getScheduledMissions({
    userId: scope.userId,
    tenantId: scope.tenantId,
    workspaceId: scope.workspaceId,
  });

  if (missions.length === 0) {
    missions = getMemoryMissions()
      .filter(
        (m) =>
          m.userId === scope.userId &&
          m.tenantId === scope.tenantId &&
          (!scope.workspaceId || m.workspaceId === scope.workspaceId),
      )
      .map((m) => ({
        id: m.id,
        tenantId: m.tenantId,
        workspaceId: m.workspaceId,
        userId: m.userId,
        name: m.name,
        input: m.input,
        schedule: m.schedule,
        enabled: m.enabled,
        createdAt: m.createdAt,
        lastRunAt: m.lastRunAt,
        lastRunId: m.lastRunId,
      }));
  }

  const signals: AmbientSignal[] = [];
  for (const mission of missions) {
    if (!mission.enabled) continue;
    if (!mission.schedule) continue;
    if (!mission.lastRunAt) continue;
    if (now - mission.lastRunAt < MISSION_SILENT_THRESHOLD_MS) continue;

    signals.push({
      id: `mission_silent:${mission.id}`,
      kind: "mission_silent",
      narration: clampNarration(
        `Mission ${mission.name} silencieuse depuis 7j — toujours pertinente ?`,
      ),
      // detectedAt = lastRunAt + threshold (instant où la mission est devenue silencieuse).
      detectedAt: new Date(mission.lastRunAt + MISSION_SILENT_THRESHOLD_MS).toISOString(),
      ctaHref: `/missions/${mission.id}`,
      severity: "info",
    });
  }
  return signals;
}

// ── Public API ─────────────────────────────────────────────────────────────

export async function getAmbientSignals(
  userId: string,
  tenantId: string,
  workspaceId?: string,
  range: AmbientSignalsRange = "1h",
): Promise<AmbientSignal[]> {
  const scope: AmbientSignalsScope = { userId, tenantId, workspaceId };
  const key = cacheKey(scope, range);
  const now = Date.now();
  const windowMs = RANGE_TO_MS[range] ?? RECENT_FAILURE_WINDOW_MS;

  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.signals;
  }

  const sources: Array<Promise<AmbientSignal[]>> = [
    safeSource("mission_failed", () => detectMissionFailed(scope, windowMs)),
    safeSource("oauth_expired", () => detectOauthExpired(scope)),
    safeSource("brief_stale", () => detectBriefStale(scope)),
    safeSource("variant_timeout", () => detectVariantTimeout(scope, windowMs)),
    safeSource("mission_silent", () => detectMissionSilent(scope)),
  ];

  const results = await Promise.all(sources);
  const merged: AmbientSignal[] = [];
  const seen = new Set<string>();
  for (const arr of results) {
    for (const sig of arr) {
      if (seen.has(sig.id)) continue;
      seen.add(sig.id);
      merged.push(sig);
    }
  }

  // Tri chronologique décroissant (récent en haut) — utile pour le SignalBoard
  // timeline view, et inoffensif pour la PulseBar qui prend visibleSignals[0..n].
  merged.sort((a, b) => Date.parse(b.detectedAt) - Date.parse(a.detectedAt));

  cache.set(key, { signals: merged, expiresAt: now + CACHE_TTL_MS });
  return merged;
}

/** Helper test : vide le cache mémoire entre cas. */
export function _resetAmbientSignalsCache(): void {
  cache.clear();
}
