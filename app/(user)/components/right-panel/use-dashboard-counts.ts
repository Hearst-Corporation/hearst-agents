"use client";

/**
 * useDashboardCounts — fetch les compteurs du Cockpit pour les modules tactiles
 * "Actions rapides" (GeneralDashboard, strate 3).
 *
 * Sources :
 *   - /api/v2/cockpit/today : missions count + missions actives + reports count
 *   - /api/v2/user/connections : services connectés / total
 *
 * Refresh : 60 s pour les deux (aligné PulseBar). Fail-soft : si fetch fail,
 * on garde la dernière valeur connue, jamais de crash.
 */

import { useEffect, useState } from "react";

export interface MissionSummary {
  id: string;
  name: string;
  status: string;
  schedule?: string | null;
}

export interface DashboardCounts {
  missionsTotal: number | null;
  missionsActive: number | null;
  missionsLive: MissionSummary[];
  reportsCount: number | null;
  assetsCount: number | null;
  connectionsConnected: number | null;
  connectionsTotal: number | null;
}

const REFRESH_MS = 60_000;

export function useDashboardCounts(): DashboardCounts {
  const [state, setState] = useState<DashboardCounts>({
    missionsTotal: null,
    missionsActive: null,
    missionsLive: [],
    reportsCount: null,
    assetsCount: null,
    connectionsConnected: null,
    connectionsTotal: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      const [todayRes, connRes] = await Promise.allSettled([
        fetch("/api/v2/cockpit/today", { cache: "no-store", credentials: "include" }).then((r) =>
          r.ok ? r.json() : null,
        ),
        fetch("/api/v2/user/connections", { cache: "no-store", credentials: "include" }).then((r) =>
          r.ok ? r.json() : null,
        ),
      ]);

      if (cancelled) return;

      const next: Partial<DashboardCounts> = {};
      if (todayRes.status === "fulfilled" && todayRes.value) {
        const data = todayRes.value as {
          counts?: { missions?: number; reports?: number; assets?: number };
          missionsRunning?: Array<{ id: string; name?: string; status: string; schedule?: string | null }>;
        };
        next.missionsTotal = data.counts?.missions ?? null;
        next.reportsCount = data.counts?.reports ?? null;
        next.assetsCount = data.counts?.assets ?? null;
        const live = (data.missionsRunning ?? []).slice(0, 5);
        next.missionsActive = live.filter((m) => m.status === "running").length;
        next.missionsLive = live.map((m) => ({
          id: m.id,
          name: m.name ?? m.id,
          status: m.status,
          schedule: m.schedule ?? null,
        }));
      }
      if (connRes.status === "fulfilled" && connRes.value) {
        const data = connRes.value as { meta?: { connected: number; total: number } };
        if (data.meta) {
          next.connectionsConnected = data.meta.connected;
          next.connectionsTotal = data.meta.total;
        }
      }

      setState((prev) => ({ ...prev, ...next }));
    }

    refresh();
    const id = window.setInterval(refresh, REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  return state;
}
