/**
 * TimelineRail — constantes et helpers partagés.
 *
 * Invariants ADD (`docs/features/timeline-rail.md`) :
 *   I-2. Regroupement temporel immuable
 *        - today : threads avec lastActivity >= now - 24h (non archivés)
 *        - thisWeek : threads avec lastActivity >= now - 7j et < now - 24h (non archivés)
 *        - archive : threads archived === true OU lastActivity < now - 7j
 *        - Seuils en ms : ONE_DAY_MS = 86_400_000, SEVEN_DAYS_MS = 604_800_000
 */

import type { Thread } from "@/stores/navigation";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * ONE_DAY_MS;

export interface ThreadGroups {
  today: Thread[];
  thisWeek: Thread[];
  archive: Thread[];
}

export function groupThreadsByDate(threads: Thread[]): ThreadGroups {
  const now = Date.now();
  const todayStart = now - ONE_DAY_MS;
  const weekStart = now - SEVEN_DAYS_MS;

  const today: Thread[] = [];
  const thisWeek: Thread[] = [];
  const archive: Thread[] = [];

  for (const t of threads) {
    if (t.archived) {
      archive.push(t);
      continue;
    }
    const ts = t.lastActivity ?? 0;
    if (ts >= todayStart) today.push(t);
    else if (ts >= weekStart) thisWeek.push(t);
    else archive.push(t);
  }

  return { today, thisWeek, archive };
}
