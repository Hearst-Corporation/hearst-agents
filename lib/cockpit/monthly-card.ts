/**
 * Cockpit "Monthly Card" — Hearst OS Wrapped (style Spotify Wrapped).
 *
 * Construit le payload utilisé par la page `/hearst-card/[userId]/[yearMonth]`
 * et l'API `/api/v2/hearst-card/[yearMonth]` pour générer une carte
 * visuelle mensuelle branded.
 *
 * Sources (toutes en parallèle, fail-soft via `safe<T>`) :
 *  - Runs orchestrator → cumul cost USD, anomalies, missions exécutées.
 *  - Assets V2 → comptage rapports + total assets.
 *  - Ambient signals retroactifs sur le mois (best-effort).
 *
 * Cache mémoire 1h par `(userId, yearMonth)` — un user ne consultera pas
 * sa card 100 fois/jour, et l'agrégation fait plusieurs round-trips DB.
 *
 * `yearMonth` : format `YYYY-MM`. La fenêtre couvre le 1er du mois 00:00
 * local jusqu'au 1er du mois suivant 00:00 (exclu). Pour le mois en cours,
 * on borne à `now`.
 */

import type { Asset } from "@/lib/assets/types";
import { loadAssetsForScope } from "@/lib/assets/types";
import { getRuns } from "@/lib/engine/runtime/state/adapter";
import type { PersistedRunRecord } from "@/lib/engine/runtime/state/types";

// ── Constantes ───────────────────────────────────────────────

const MAX_TOP_MISSIONS = 5;
const MAX_TOP_REPORTS = 3;
const RUNS_FETCH_LIMIT = 1000;
const CACHE_TTL_MS = 60 * 60_000; // 1h
const KPI_COUNT = 3;

// ── Types ────────────────────────────────────────────────────

export interface MonthlyCardScope {
  userId: string;
  tenantId: string;
  workspaceId?: string;
}

export interface MonthlyCardWindow {
  /** Epoch ms — 1er du mois 00:00 local. */
  fromMs: number;
  /** Epoch ms — 1er du mois suivant 00:00 local (exclu) ou now si mois en cours. */
  toMs: number;
  /** "YYYY-MM". */
  yearMonth: string;
  /** Libellé long FR : "Mai 2026". */
  label: string;
  /** Vrai si la fenêtre concerne le mois en cours (pas encore terminé). */
  inProgress: boolean;
}

export interface MonthlyCardMissionRow {
  missionId: string;
  name: string;
  runs: number;
  successes: number;
  successRate: number;
}

export interface MonthlyCardReportRow {
  id: string;
  title: string;
  kind: string;
  createdAt: number;
}

export interface MonthlyCardKpi {
  label: string;
  value: string;
  /** Sub-label optionnel (ex : "+12% vs mois précédent"). */
  delta?: string;
}

export interface MonthlyCardBestMoment {
  kind: "mission" | "report";
  title: string;
  /** Narration courte FR (≤ 90ch) — "5 runs réussis sans erreur" etc. */
  reason: string;
}

export interface MonthlyCardData {
  scope: MonthlyCardScope;
  window: MonthlyCardWindow;
  /** Total runs (success + failed) sur le mois. */
  missionsRun: number;
  /** Top missions par successes. */
  topMissions: MonthlyCardMissionRow[];
  /** Total assets de type rapport créés sur le mois. */
  reportsGenerated: number;
  /** Top 3 rapports les plus récents. */
  topReports: MonthlyCardReportRow[];
  /** Anomalies = runs failed sur le mois. */
  anomaliesCount: number;
  /** Top 3 KPIs : assets total, cost USD, success rate %. */
  kpis: MonthlyCardKpi[];
  /** Le moment fort du mois — heuristique : mission avec le plus de successes. */
  bestMoment: MonthlyCardBestMoment | null;
  generatedAt: number;
}

// ── Cache mémoire ────────────────────────────────────────────

interface CachedEntry {
  expiresAt: number;
  data: MonthlyCardData;
}

const cache = new Map<string, CachedEntry>();

function cacheKey(scope: MonthlyCardScope, yearMonth: string): string {
  return `${scope.tenantId}:${scope.workspaceId ?? "*"}:${scope.userId}:${yearMonth}`;
}

/** Test-only — vidage du cache. */
export function _resetMonthlyCardCache(): void {
  cache.clear();
}

// ── Helpers ──────────────────────────────────────────────────

async function safe<T>(label: string, fn: () => Promise<T> | T, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.warn(`[cockpit/monthly-card] source "${label}" en erreur, fallback appliqué:`, err);
    return fallback;
  }
}

/**
 * Parse un yearMonth `YYYY-MM` et calcule la fenêtre. Throw si format invalide.
 * Pour le mois en cours, `toMs` est borné à `now`.
 */
export function buildMonthlyWindow(yearMonth: string, now: Date = new Date()): MonthlyCardWindow {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(yearMonth);
  if (!match) {
    throw new Error(`Invalid yearMonth format: ${yearMonth} (expected YYYY-MM)`);
  }
  const year = Number(match[1]);
  const monthIdx = Number(match[2]) - 1; // 0-based for Date

  const start = new Date(year, monthIdx, 1, 0, 0, 0, 0);
  const nextMonth = new Date(year, monthIdx + 1, 1, 0, 0, 0, 0);

  const isCurrentMonth = now.getFullYear() === year && now.getMonth() === monthIdx;
  const inProgress = isCurrentMonth;
  const toMs = inProgress ? Math.min(now.getTime(), nextMonth.getTime()) : nextMonth.getTime();

  const fmt = new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
  });
  const labelRaw = fmt.format(start);
  const label = labelRaw.charAt(0).toUpperCase() + labelRaw.slice(1);

  return {
    fromMs: start.getTime(),
    toMs,
    yearMonth,
    label,
    inProgress,
  };
}

function isInWindow(ts: number | undefined, window: MonthlyCardWindow): boolean {
  if (!ts) return false;
  return ts >= window.fromMs && ts < window.toMs;
}

/** Détecte si un asset est un rapport (kind contient "report" ou "deck"). */
function isReportAsset(asset: Asset): boolean {
  const kind = String(asset.kind).toLowerCase();
  return (
    kind.includes("report") ||
    kind.includes("deck") ||
    kind.includes("brief") ||
    kind === "document"
  );
}

interface MissionAggregate {
  name: string;
  runs: number;
  successes: number;
}

function aggregateMissions(
  runs: PersistedRunRecord[],
  window: MonthlyCardWindow,
): { missions: Map<string, MissionAggregate>; totalCost: number; failed: number } {
  const missions = new Map<string, MissionAggregate>();
  let totalCost = 0;
  let failed = 0;

  for (const run of runs) {
    const at = run.completedAt ?? run.createdAt;
    if (!isInWindow(at, window)) continue;

    if (typeof run.metrics?.costUsd === "number" && Number.isFinite(run.metrics.costUsd)) {
      totalCost += run.metrics.costUsd;
    }
    if (run.status === "failed") failed += 1;

    const missionId = run.missionId;
    if (!missionId) continue;

    const meta = (run.metadata ?? {}) as Record<string, unknown>;
    const fallbackName =
      (meta.missionName as string | undefined) ?? run.input?.slice(0, 60) ?? missionId;

    const entry = missions.get(missionId) ?? {
      name: fallbackName,
      runs: 0,
      successes: 0,
    };
    entry.runs += 1;
    if (run.status === "completed") entry.successes += 1;
    missions.set(missionId, entry);
  }

  return { missions, totalCost, failed };
}

function pickTopMissions(missions: Map<string, MissionAggregate>): MonthlyCardMissionRow[] {
  const rows: MonthlyCardMissionRow[] = Array.from(missions.entries()).map(([missionId, agg]) => ({
    missionId,
    name: agg.name,
    runs: agg.runs,
    successes: agg.successes,
    successRate: agg.runs === 0 ? 0 : Math.round((agg.successes / agg.runs) * 100),
  }));
  // Tri : successes desc, puis successRate desc, puis runs desc.
  rows.sort(
    (a, b) => b.successes - a.successes || b.successRate - a.successRate || b.runs - a.runs,
  );
  return rows.slice(0, MAX_TOP_MISSIONS);
}

function pickTopReports(
  assets: Asset[],
  window: MonthlyCardWindow,
): { count: number; rows: MonthlyCardReportRow[] } {
  const reportsInWindow = assets.filter((a) => isInWindow(a.createdAt, window) && isReportAsset(a));
  reportsInWindow.sort((a, b) => b.createdAt - a.createdAt);
  const rows = reportsInWindow.slice(0, MAX_TOP_REPORTS).map((a) => ({
    id: a.id,
    title: a.title,
    kind: String(a.kind),
    createdAt: a.createdAt,
  }));
  return { count: reportsInWindow.length, rows };
}

function buildKpis(
  totalAssets: number,
  totalCostUsd: number,
  totalRuns: number,
  successes: number,
): MonthlyCardKpi[] {
  const successRate = totalRuns === 0 ? 0 : Math.round((successes / totalRuns) * 100);
  const costFormatted =
    totalCostUsd >= 100 ? `$${Math.round(totalCostUsd)}` : `$${totalCostUsd.toFixed(2)}`;

  const kpis: MonthlyCardKpi[] = [
    { label: "Assets créés", value: String(totalAssets) },
    { label: "Coût IA", value: costFormatted },
    { label: "Taux de succès", value: `${successRate}%` },
  ];
  return kpis.slice(0, KPI_COUNT);
}

function buildBestMoment(
  topMissions: MonthlyCardMissionRow[],
  topReports: MonthlyCardReportRow[],
): MonthlyCardBestMoment | null {
  // Heuristique : on privilégie la mission qui a le plus de successes.
  // Fallback : le rapport le plus récent.
  const bestMission = topMissions[0];
  if (bestMission && bestMission.successes > 0) {
    const reason =
      bestMission.successes === 1 ? "1 run réussi" : `${bestMission.successes} runs réussis`;
    return {
      kind: "mission",
      title: bestMission.name,
      reason: `${reason}${bestMission.successRate >= 90 ? " · sans accroc" : ""}`,
    };
  }
  const bestReport = topReports[0];
  if (bestReport) {
    return {
      kind: "report",
      title: bestReport.title,
      reason: "Rapport phare du mois",
    };
  }
  return null;
}

// ── API publique ─────────────────────────────────────────────

export async function buildMonthlyCardData(
  scope: MonthlyCardScope,
  yearMonth: string,
  options?: { now?: Date; bypassCache?: boolean },
): Promise<MonthlyCardData> {
  const window = buildMonthlyWindow(yearMonth, options?.now ?? new Date());
  const key = cacheKey(scope, yearMonth);

  if (!options?.bypassCache) {
    const cached = cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }
  }

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
          limit: 500,
        }),
      [],
    ),
  ]);

  const { missions, totalCost, failed } = aggregateMissions(runs, window);
  const topMissions = pickTopMissions(missions);
  const { count: reportsGenerated, rows: topReports } = pickTopReports(assets, window);

  const totalRuns = runs.filter((r) => isInWindow(r.completedAt ?? r.createdAt, window)).length;
  const totalSuccesses = totalRuns - failed;
  const totalAssets = assets.filter((a) => isInWindow(a.createdAt, window)).length;

  const kpis = buildKpis(totalAssets, totalCost, totalRuns, totalSuccesses);
  const bestMoment = buildBestMoment(topMissions, topReports);

  const data: MonthlyCardData = {
    scope,
    window,
    missionsRun: totalRuns,
    topMissions,
    reportsGenerated,
    topReports,
    anomaliesCount: failed,
    kpis,
    bestMoment,
    generatedAt: Date.now(),
  };

  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, data });
  return data;
}

/**
 * Helper : retourne le yearMonth (`YYYY-MM`) du mois précédent l'instant
 * fourni. Utilisé par le cron mensuel.
 */
export function previousYearMonth(now: Date = new Date()): string {
  const ref = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const year = ref.getFullYear();
  const month = String(ref.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}
