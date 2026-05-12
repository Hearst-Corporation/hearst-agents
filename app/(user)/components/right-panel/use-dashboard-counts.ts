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
      // Double source : on hit cockpit/today (rapide, agrégé) ET on garde
      // /api/v2/missions en fallback si la première source renvoie vide.
      // Sans ce filet, un état transitoire de getCockpitToday (cache cold,
      // race scheduler, première hydratation) rend "Créer une première
      // mission" alors que les missions existent et sont visibles via
      // /api/v2/missions.
      const [todayRes, missionsRes] = await Promise.all([
        fetch("/api/v2/cockpit/today", { cache: "no-store", credentials: "include" })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        fetch("/api/v2/missions", { cache: "no-store", credentials: "include" })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      ]);

      if (cancelled) return;

      const next: Partial<DashboardCounts> = {};
      let liveMissions: Array<{ id: string; name?: string; status: string; schedule?: string | null; lastRunAt?: number; lastRunStatus?: string }> = [];

      if (todayRes) {
        const data = todayRes as {
          counts?: { missions?: number; reports?: number; assets?: number };
          missionsRunning?: typeof liveMissions;
        };
        next.missionsTotal = data.counts?.missions ?? null;
        next.reportsCount = data.counts?.reports ?? null;
        next.assetsCount = data.counts?.assets ?? null;
        liveMissions = data.missionsRunning ?? [];
      }

      // Fallback : si cockpit/today n'a rien remonté mais que l'endpoint
      // /api/v2/missions liste des missions, on les utilise. Source canonique
      // de vérité pour la zone droite.
      if (liveMissions.length === 0 && missionsRes) {
        const missionsList = (missionsRes as { missions?: Array<{ id: string; name?: string; lastRunStatus?: string; schedule?: string; enabled?: boolean; lastRunAt?: number }> }).missions ?? [];
        liveMissions = missionsList
          .filter((m) => m.enabled !== false)
          .slice(0, 5)
          .map((m) => ({
            id: m.id,
            name: m.name,
            status: m.lastRunStatus ?? "idle",
            schedule: m.schedule ?? null,
            lastRunAt: m.lastRunAt,
          }));
        if (next.missionsTotal == null) {
          next.missionsTotal = missionsList.length;
        }
      }

      const DONE_STATUSES = new Set(["completed", "success", "done", "succeeded", "terminé"]);
      const live = liveMissions
        .filter((m) => !DONE_STATUSES.has(m.status))
        .slice(0, 5);
      next.missionsActive = live.filter((m) => m.status === "running").length;
      next.missionsLive = live.map((m) => ({
        id: m.id,
        name: m.name ?? m.id,
        status: m.status,
        schedule: m.schedule ?? null,
      }));

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
