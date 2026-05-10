"use client";
// lint-visual-disable-file

import { useCallback, useEffect, useState } from "react";
import { CockpitOrbitView } from "../cockpit/orbital/CockpitOrbitView";
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
      {!loading && !error && data && <CockpitOrbitView data={data} onRefresh={refetch} />}
    </div>
  );
}

function CockpitSkeleton() {
  return (
    <div
      className="flex-1 flex flex-col"
      style={{
        padding: "48px 64px",
        gap: "40px",
      }}
      aria-busy="true"
      aria-live="polite"
    >
      {/* Header */}
      <div className="flex flex-col" style={{ gap: "12px" }}>
        <div
          className="animate-pulse"
          style={{ height: "16px", width: "120px", background: "rgba(255, 255, 255, 0.05)", borderRadius: "4px" }}
        />
        <div
          className="animate-pulse"
          style={{ height: "48px", width: "240px", background: "rgba(255, 255, 255, 0.05)", borderRadius: "4px" }}
        />
      </div>

      {/* Briefing */}
      <div className="flex flex-col" style={{ gap: "16px" }}>
        <div
          className="animate-pulse"
          style={{ height: "24px", width: "75%", background: "rgba(255, 255, 255, 0.05)", borderRadius: "4px" }}
        />
        <div className="flex flex-col" style={{ gap: "8px" }}>
          {[0.65, 0.55, 0.45].map((w, i) => (
            <div
              key={i}
              className="animate-pulse"
              style={{ height: "16px", width: `${w * 100}%`, background: "rgba(255, 255, 255, 0.05)", borderRadius: "4px" }}
            />
          ))}
        </div>
      </div>

      {/* Sections */}
      <div
        className="flex flex-col"
        style={{ gap: "40px", paddingTop: "24px", borderTop: "1px solid rgba(255, 255, 255, 0.06)" }}
      >
        {[3, 2, 3].map((lines, si) => (
          <div key={si} className="flex flex-col" style={{ gap: "12px" }}>
            <div
              className="animate-pulse"
              style={{ height: "12px", width: "96px", background: "rgba(255, 255, 255, 0.05)", borderRadius: "4px", marginBottom: "4px" }}
            />
            {Array.from({ length: lines }).map((_, li) => (
              <div
                key={li}
                className="animate-pulse"
                style={{ height: "12px", width: `${(0.8 - li * 0.1) * 100}%`, background: "rgba(255, 255, 255, 0.05)", borderRadius: "4px" }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function CockpitErrorState({ message }: { message: string }) {
  return (
    <div
      className="flex-1 flex flex-col items-start justify-center"
      style={{ padding: "48px 56px", gap: "12px" }}
    >
      <span className="font-light" style={{ fontSize: "11px", letterSpacing: "0.08em", color: "rgba(255, 255, 255, 0.3)", textTransform: "uppercase" }}>Cockpit · erreur</span>
      <p className="font-light" style={{ fontSize: "18px", color: "rgba(255, 255, 255, 0.88)", maxWidth: "420px", lineHeight: "1.4" }}>
        Impossible de charger ton cockpit pour le moment.
      </p>
      <p className="font-mono" style={{ fontSize: "11px", color: "rgba(255, 255, 255, 0.25)" }}>
        {message}
      </p>
    </div>
  );
}
