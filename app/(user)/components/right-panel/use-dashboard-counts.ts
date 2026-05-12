"use client";

/**
 * useDashboardCounts — fetch les compteurs du Cockpit pour les modules tactiles
 * "Actions rapides" (GeneralDashboard, strate 3).
 *
 * Sources :
 *   - /api/v2/cockpit/today : missions count + missions actives + reports count
 *   - useServicesStore (hydraté par HomePageClient + refresh PulseBar) :
 *     services connectés / total. Pas de fetch dédié ici — on lit le store
 *     pour éviter le refetch storm sur /api/v2/user/connections (jusqu'à 4×
 *     au mount avant la dedupe).
 *
 * Refresh : 60 s pour cockpit/today. Fail-soft : si fetch fail, on garde la
 * dernière valeur connue, jamais de crash.
 */

import { useEffect, useState } from "react";
import { useServicesStore } from "@/stores/services";

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
  /**
   * `true` tant que le premier fetch n'a pas répondu. Permet aux zones
   * d'afficher un skeleton plutôt que le flash empty state ("Créer une
   * première mission") qui se montre quelques centaines de ms avant que
   * `/api/v2/cockpit/today` revienne.
   */
  initialLoading: boolean;
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
    initialLoading: true,
  });

  // Connections : dérivées du store partagé. HomePageClient hydrate, PulseBar
  // rafraîchit toutes les 60 s. On évite ainsi un fetch /api/v2/user/connections
  // dédié pour ce hook.
  const services = useServicesStore((s) => s.services);
  const servicesLoaded = useServicesStore((s) => s.loaded);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      const todayRes = await fetch("/api/v2/cockpit/today", {
        cache: "no-store",
        credentials: "include",
      })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);

      if (cancelled) return;

      const next: Partial<DashboardCounts> = {};
      if (todayRes) {
        const data = todayRes as {
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

      setState((prev) => ({ ...prev, ...next, initialLoading: false }));
    }

    refresh();
    const id = window.setInterval(refresh, REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  // Compteurs services dérivés à la volée du store partagé — pas de setState
  // en effect (évite la boucle + warning react-hooks/set-state-in-effect).
  const connectionsConnected = servicesLoaded
    ? services.filter((s) => s.connectionStatus === "connected").length
    : null;
  const connectionsTotal = servicesLoaded ? services.length : null;

  return {
    ...state,
    connectionsConnected,
    connectionsTotal,
  };
}
