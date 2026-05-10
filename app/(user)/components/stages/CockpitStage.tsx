"use client";

import { useCallback, useEffect, useState } from "react";
import { CockpitHome } from "../cockpit/CockpitHome";
import { OnboardingTour } from "../OnboardingTour";
import type { CockpitTodayPayload } from "@/lib/cockpit/today";
import { usePollingEffect } from "@/app/hooks/use-polling-effect";

/**
 * CockpitStage — home polymorphe (mode="cockpit").
 *
 * Affiche au mount un agrégat /api/v2/cockpit/today : agenda + briefing humain
 * + agents working + suggestions actionables. La constellation Hearst reste en
 * background.
 *
 * Loading : skeleton — pas de spinner. Sync client au mount (même si RSC a
 * pré-hydraté) pour garantir la fraîcheur ; phase B : focus / visibilité.
 *
 * Empty states : chaque section a son CTA contextuel (pas de glyphes seuls
 * selon la règle CLAUDE.md §5).
 */
interface CockpitStageProps {
  /**
   * Phase C5 — payload Cockpit pré-fetché par le RSC parent (`page.tsx`).
   * First paint immédiat + sync client au mount.
   */
  initialData?: CockpitTodayPayload | null;
}

function logCockpitSyncedDev(payload: CockpitTodayPayload) {
  if (process.env.NODE_ENV !== "development") return;
  console.info("[CockpitStage] cockpit/today synchronisé", {
    missionsRunning: payload.missionsRunning.length,
    agendaCount: payload.agenda.length,
    suggestions: payload.suggestions.length,
    generatedAt: payload.generatedAt,
  });
}

export function CockpitStage({ initialData = null }: CockpitStageProps = {}) {
  const [data, setData] = useState<CockpitTodayPayload | null>(initialData);
  const [loading, setLoading] = useState(initialData === null);
  const [error, setError] = useState<string | null>(null);

  const applyCockpitPayload = useCallback((payload: CockpitTodayPayload) => {
    setData(payload);
    setError(null);
    logCockpitSyncedDev(payload);
  }, []);

  const refetch = useCallback(async () => {
    try {
      const res = await fetch("/api/v2/cockpit/today", { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = (await res.json()) as CockpitTodayPayload;
      applyCockpitPayload(payload);
    } catch (err) {
      setData((prev) => {
        if (prev !== null) {
          console.warn(
            "[CockpitStage] refetch cockpit échoué, conservation du snapshot :",
            err instanceof Error ? err.message : err,
          );
          return prev;
        }
        setError(err instanceof Error ? err.message : "Erreur");
        return prev;
      });
    } finally {
      setLoading(false);
    }
  }, [applyCockpitPayload]);

  useEffect(() => {
    // initialData (RSC) sert au LCP ; on synchronise toujours au mount avec
    // l’API pour éviter des KPI figés sur le snapshot SSR (session longue).
    let cancelled = false;
    const run = async () => {
      try {
        const res = await fetch("/api/v2/cockpit/today", { credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = (await res.json()) as CockpitTodayPayload;
        if (!cancelled) applyCockpitPayload(payload);
      } catch (err) {
        if (!cancelled) {
          setData((prev) => {
            if (prev !== null) {
              console.warn(
                "[CockpitStage] refresh cockpit échoué, conservation du snapshot :",
                err instanceof Error ? err.message : err,
              );
              return prev;
            }
            setError(err instanceof Error ? err.message : "Erreur");
            return prev;
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [applyCockpitPayload]);

  // Polling 60s — maintient le cockpit à jour sans reload de page
  usePollingEffect(refetch, 60_000, [], { enabled: true, immediate: false });

  return (
    <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
      <OnboardingTour />
      {loading && <CockpitSkeleton />}
      {!loading && error && <CockpitErrorState message={error} />}
      {!loading && !error && data && <CockpitHome data={data} />}
    </div>
  );
}

function CockpitSkeleton() {
  return (
    <div
      className="flex-1 flex flex-col"
      style={{ padding: "var(--space-12) var(--space-14)" }}
      aria-busy="true"
      aria-live="polite"
    >
      <div
        className="grid"
        style={{
          gridTemplateColumns: "minmax(280px, 0.9fr) minmax(0, 1.4fr)",
          gap: "var(--space-12)",
          alignItems: "start",
        }}
      >
        <div className="flex flex-col" style={{ gap: "var(--space-4)" }}>
          <div
            className="animate-pulse"
            style={{
              height: "var(--space-24)",
              width: "70%",
              background: "var(--surface-1)",
              borderRadius: "var(--radius-xs)",
            }}
          />
          <div
            className="animate-pulse"
            style={{
              height: "var(--space-16)",
              width: "55%",
              background: "var(--surface-1)",
              borderRadius: "var(--radius-xs)",
            }}
          />
        </div>
        <div className="flex flex-col" style={{ gap: "var(--space-5)" }}>
          <div
            className="animate-pulse"
            style={{
              height: "var(--space-10)",
              width: "var(--space-32)",
              background: "var(--surface-1)",
              borderRadius: "var(--radius-xs)",
            }}
          />
          <div
            className="animate-pulse"
            style={{
              height: "var(--space-24)",
              width: "80%",
              background: "var(--surface-1)",
              borderRadius: "var(--radius-xs)",
            }}
          />
        </div>
      </div>
    </div>
  );
}

function CockpitErrorState({ message }: { message: string }) {
  return (
    <div
      className="flex-1 flex flex-col items-start justify-center"
      style={{ padding: "var(--space-12) var(--space-14)", gap: "var(--space-3)" }}
    >
      <span className="poster-eyebrow">Cockpit · erreur</span>
      <p className="t-18" style={{ color: "var(--text)", maxWidth: "var(--width-prose-narrow)", lineHeight: "var(--leading-snug)" }}>
        Impossible de charger ton cockpit pour le moment.
      </p>
      <p className="t-11 font-mono" style={{ color: "var(--text-faint)" }}>
        {message}
      </p>
    </div>
  );
}
