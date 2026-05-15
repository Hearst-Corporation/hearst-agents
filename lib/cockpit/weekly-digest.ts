/**
 * Cockpit "Weekly Digest" — Agrégateur d'activité hebdomadaire.
 *
 * Construit le payload utilisé par le workflow Slack Digest hebdomadaire
 * (template `weekly-slack-digest` + cron Inngest vendredi 17h).
 *
 * Sources (toutes en parallèle, fail-soft via `safe<T>`) :
 *  - Missions completed sur la fenêtre (lundi 00:00 → vendredi 17:00 local).
 *  - Runs orchestrator → cumul cost USD + anomalies (runs failed sur la
 *    fenêtre, considérés comme "signaux à inspecter" plutôt qu'erreurs
 *    silencieuses).
 *  - Top 3 assets ouverts/créés sur la fenêtre — fallback sur `createdAt`
 *    quand `lastOpenedAt` n'est pas tracé.
 *  - Best mission (la plus de runs réussis sur la fenêtre).
 *
 * Toute source qui throw est isolée — fenêtre rendue avec moins de
 * données est préférable à un digest qui plante.
 */

import type { Asset } from "@/lib/assets/types";
import { loadAssetsForScope } from "@/lib/assets/types";
import { getRuns } from "@/lib/engine/runtime/state/adapter";
import type { PersistedRunRecord } from "@/lib/engine/runtime/state/types";

interface WeeklyDigestScope {
  userId: string;
  tenantId: string;
  workspaceId?: string;
}

export interface WeeklyDigestMissionRow {
  missionId: string;
  name: string;
  runs: number;
  successes: number;
  lastRunAt: number;
}

export interface WeeklyDigestAnomalyRow {
  runId: string;
  missionId?: string;
  missionName?: string;
  error: string;
  failedAt: number;
}

export interface WeeklyDigestAssetRow {
  id: string;
  title: string;
  kind: string;
  createdAt: number;
}

export interface WeeklyDigestWindow {
  /** Epoch ms — lundi 00:00 local (Europe/Paris). */
  fromMs: number;
  /** Epoch ms — vendredi 17:00 local (Europe/Paris). */
  toMs: number;
  /** Libellé court : "5 → 10 mai". */
  label: string;
}

export interface WeeklyDigestPayload {
  scope: WeeklyDigestScope;
  window: WeeklyDigestWindow;
  /** Missions ayant au moins un run sur la fenêtre, triées par runs desc. */
  missionsCompleted: WeeklyDigestMissionRow[];
  /** Runs failed sur la fenêtre — surface "signaux à inspecter". */
  anomalies: WeeklyDigestAnomalyRow[];
  /** Top 3 assets créés/ouverts sur la fenêtre. */
  topAssets: WeeklyDigestAssetRow[];
  /** Cumul de tous les runs sur la fenêtre (success + failed). */
  totalRuns: number;
  /** Cumul cost USD (basé sur metrics.costUsd des runs). */
  totalCostUsd: number;
  /** Mission la plus performante (plus de successes sur la fenêtre). */
  bestMission: WeeklyDigestMissionRow | null;
  generatedAt: number;
}

const MAX_TOP_ASSETS = 3;
const MAX_ANOMALIES = 5;
const MAX_MISSIONS_LISTED = 5;
const RUNS_FETCH_LIMIT = 200;

/**
 * Fail-soft wrapper : exécute le getter, retourne fallback si throw.
 */
async function safe<T>(label: string, fn: () => Promise<T> | T, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.warn(`[cockpit/weekly-digest] source "${label}" en erreur, fallback appliqué:`, err);
    return fallback;
  }
}

/**
 * Calcule la fenêtre lundi 00:00 → vendredi 17:00 (Europe/Paris) qui se
 * termine au moment de l'appel. Si on est appelé avant vendredi 17h, on
 * retourne la semaine en cours ; sinon la semaine courante (jusqu'à now).
 *
 * Note : on n'utilise pas Intl.DateTimeFormat avec timeZone Paris pour
 * éviter les ambiguïtés DST. La logique reste suffisamment fiable pour
 * un digest hebdo (tolérance ±1h).
 */
export function buildWeeklyWindow(now: Date = new Date()): WeeklyDigestWindow {
  const ref = new Date(now.getTime());
  // 0 = dimanche, 1 = lundi … 6 = samedi
  const dow = ref.getDay();
  const daysSinceMonday = dow === 0 ? 6 : dow - 1;

  const monday = new Date(ref.getTime());
  monday.setDate(ref.getDate() - daysSinceMonday);
  monday.setHours(0, 0, 0, 0);

  const friday = new Date(monday.getTime());
  friday.setDate(monday.getDate() + 4);
  friday.setHours(17, 0, 0, 0);

  // Si on est avant vendredi 17h, on ferme à `now` plutôt qu'au futur.
  const toMs = Math.min(ref.getTime(), friday.getTime());

  const fmt = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
  });
  const label = `${fmt.format(monday)} → ${fmt.format(new Date(toMs))}`;

  return {
    fromMs: monday.getTime(),
    toMs,
    label,
  };
}

function isInWindow(ts: number | undefined, window: WeeklyDigestWindow): boolean {
  if (!ts) return false;
  return ts >= window.fromMs && ts <= window.toMs;
}

/**
 * Index runs par missionId pour calculer agrégats.
 */
function aggregateMissions(
  runs: PersistedRunRecord[],
  window: WeeklyDigestWindow,
): { rows: WeeklyDigestMissionRow[]; totalCost: number } {
  const byMission = new Map<
    string,
    { name: string; runs: number; successes: number; lastRunAt: number }
  >();
  let totalCost = 0;

  for (const run of runs) {
    const completedAt = run.completedAt ?? run.createdAt;
    if (!isInWindow(completedAt, window)) continue;

    if (typeof run.metrics?.costUsd === "number" && Number.isFinite(run.metrics.costUsd)) {
      totalCost += run.metrics.costUsd;
    }

    const missionId = run.missionId;
    if (!missionId) continue;

    const meta = (run.metadata ?? {}) as Record<string, unknown>;
    const fallbackName =
      (meta.missionName as string | undefined) ?? run.input?.slice(0, 60) ?? missionId;

    const entry = byMission.get(missionId) ?? {
      name: fallbackName,
      runs: 0,
      successes: 0,
      lastRunAt: 0,
    };
    entry.runs += 1;
    if (run.status === "completed") entry.successes += 1;
    entry.lastRunAt = Math.max(entry.lastRunAt, completedAt);
    byMission.set(missionId, entry);
  }

  const rows: WeeklyDigestMissionRow[] = Array.from(byMission.entries()).map(
    ([missionId, agg]) => ({
      missionId,
      name: agg.name,
      runs: agg.runs,
      successes: agg.successes,
      lastRunAt: agg.lastRunAt,
    }),
  );

  rows.sort((a, b) => b.runs - a.runs || b.lastRunAt - a.lastRunAt);

  return { rows, totalCost };
}

function extractAnomalies(
  runs: PersistedRunRecord[],
  missionRows: WeeklyDigestMissionRow[],
  window: WeeklyDigestWindow,
): WeeklyDigestAnomalyRow[] {
  const missionNameById = new Map<string, string>();
  for (const row of missionRows) missionNameById.set(row.missionId, row.name);

  const anomalies: WeeklyDigestAnomalyRow[] = [];
  for (const run of runs) {
    if (run.status !== "failed") continue;
    const failedAt = run.completedAt ?? run.createdAt;
    if (!isInWindow(failedAt, window)) continue;

    const meta = (run.metadata ?? {}) as Record<string, unknown>;
    const errMsg =
      (meta.error as string | undefined) ?? (meta.lastError as string | undefined) ?? "Run failed";

    anomalies.push({
      runId: run.id,
      missionId: run.missionId,
      missionName: run.missionId ? missionNameById.get(run.missionId) : undefined,
      error: errMsg.slice(0, 200),
      failedAt,
    });
  }

  anomalies.sort((a, b) => b.failedAt - a.failedAt);
  return anomalies.slice(0, MAX_ANOMALIES);
}

function pickTopAssets(assets: Asset[], window: WeeklyDigestWindow): WeeklyDigestAssetRow[] {
  const inWindow = assets.filter((a) => isInWindow(a.createdAt, window));
  inWindow.sort((a, b) => b.createdAt - a.createdAt);
  return inWindow.slice(0, MAX_TOP_ASSETS).map((a) => ({
    id: a.id,
    title: a.title,
    kind: String(a.kind),
    createdAt: a.createdAt,
  }));
}

export async function buildWeeklyDigest(
  scope: WeeklyDigestScope,
  options?: { now?: Date },
): Promise<WeeklyDigestPayload> {
  const window = buildWeeklyWindow(options?.now ?? new Date());

  const [runs, assets] = await Promise.all([
    safe<PersistedRunRecord[]>(
      "runs",
      () =>
        getRuns({
          userId: scope.userId,
          tenantId: scope.tenantId,
          workspaceId: scope.workspaceId,
          limit: RUNS_FETCH_LIMIT,
        }),
      [],
    ),
    safe<Asset[]>(
      "assets",
      () =>
        loadAssetsForScope({
          tenantId: scope.tenantId,
          workspaceId: scope.workspaceId ?? "",
          userId: scope.userId,
          limit: 50,
        }),
      [],
    ),
  ]);

  const { rows: missionsAll, totalCost } = aggregateMissions(runs, window);
  const missionsCompleted = missionsAll.slice(0, MAX_MISSIONS_LISTED);
  const anomalies = extractAnomalies(runs, missionsAll, window);
  const topAssets = pickTopAssets(assets, window);

  const totalRuns = runs.filter((r) => isInWindow(r.completedAt ?? r.createdAt, window)).length;

  // Best mission = celle avec le plus de successes (tiebreak runs desc).
  const bestMission =
    [...missionsAll].sort((a, b) => b.successes - a.successes || b.runs - a.runs)[0] ?? null;

  return {
    scope,
    window,
    missionsCompleted,
    anomalies,
    topAssets,
    totalRuns,
    totalCostUsd: Math.round(totalCost * 10000) / 10000,
    bestMission,
    generatedAt: Date.now(),
  };
}
