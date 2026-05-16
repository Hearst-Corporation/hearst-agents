/**
 * Mission Budget — agrégation mensuelle des coûts par mission (S3-D).
 *
 * Lit la table `runs` (Supabase), filtre par `metadata.missionId` et fenêtre
 * calendaire UTC [yearMonth-01, nextMonth-01[. Cache LRU 5 min pour éviter
 * de hammeriser la DB sur le hot path scheduler.
 *
 * Utilisé par :
 *  - lib/engine/runtime/missions/scheduler.ts → hard-stop avant trigger.
 *  - app/(user)/components/cockpit/MissionBudgetBadge.tsx → indicateur UI.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerSupabase } from "@/lib/platform/db/supabase";

const CACHE_TTL_MS = 5 * 60_000;

interface CacheEntry {
  value: number;
  expiresAt: number;
}

const cache: Map<string, CacheEntry> = new Map();

function db(): SupabaseClient | null {
  return getServerSupabase();
}

/**
 * Retourne le yearMonth UTC ("YYYY-MM") pour la date donnée. Par défaut now.
 */
export function currentYearMonth(date: Date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * Retourne les bornes ISO [start, end[ d'un yearMonth ("YYYY-MM").
 */
function monthBounds(yearMonth: string): { startIso: string; endIso: string } {
  const [yStr, mStr] = yearMonth.split("-");
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

/**
 * Somme `cost_usd` de tous les runs d'une mission pour le mois calendaire UTC.
 * Cache 5 min — pour le hot path scheduler. Les runs en cours du mois courant
 * sont rafraîchis à la prochaine fenêtre cache.
 */
export async function getMonthlyMissionCost(
  missionId: string,
  yearMonth: string = currentYearMonth(),
): Promise<number> {
  const cacheKey = `${missionId}:${yearMonth}`;
  const hit = cache.get(cacheKey);
  if (hit && hit.expiresAt > Date.now()) {
    return hit.value;
  }

  const sb = db();
  if (!sb) return 0;

  const { startIso, endIso } = monthBounds(yearMonth);

  try {
    const { data, error } = await sb
      .from("runs")
      .select("cost_usd")
      .filter("metadata->>missionId", "eq", missionId)
      .gte("created_at", startIso)
      .lt("created_at", endIso);

    if (error) {
      console.warn(`[MissionBudget] getMonthlyMissionCost error (${missionId}):`, error.message);
      return 0;
    }

    const total = (data ?? []).reduce(
      (sum, row) => sum + Number((row as { cost_usd?: number | null }).cost_usd ?? 0),
      0,
    );

    cache.set(cacheKey, { value: total, expiresAt: Date.now() + CACHE_TTL_MS });
    return total;
  } catch (err) {
    console.warn(`[MissionBudget] getMonthlyMissionCost exception (${missionId}):`, err);
    return 0;
  }
}

export interface MissionBudgetState {
  budgetUsd: number;
  currentUsd: number;
  utilization: number;
  remainingUsd: number;
  exceeded: boolean;
}

/**
 * État budget consolidé d'une mission. Retourne null si pas de budget configuré.
 */
export async function getMissionBudgetState(
  missionId: string,
  budgetUsd: number | undefined,
  yearMonth: string = currentYearMonth(),
): Promise<MissionBudgetState | null> {
  if (!budgetUsd || budgetUsd <= 0) return null;

  const currentUsd = await getMonthlyMissionCost(missionId, yearMonth);
  const utilization = currentUsd / budgetUsd;
  const remainingUsd = Math.max(0, budgetUsd - currentUsd);
  const exceeded = currentUsd >= budgetUsd;

  return {
    budgetUsd,
    currentUsd,
    utilization,
    remainingUsd,
    exceeded,
  };
}

/**
 * Helper de test — vide le cache mémoire. Server-only.
 */
export function _resetBudgetCache(): void {
  cache.clear();
}
