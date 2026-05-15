"use client";

import type { SpatialPanelCardProps } from "@/lib/spatial/panel-registry";
import { useRuntimeStore } from "@/stores/runtime";
import { CockpitCardShell } from "./CockpitCardShell";

/**
 * Card Approval — HITL bloquant.
 *
 * Apparaît quand l'agent attend une validation explicite.
 * Catégorie interruptive : le reste de la scène est dim, ce panel est centré.
 */
export function CockpitApprovalCard(_props: SpatialPanelCardProps) {
  const currentPlan = useRuntimeStore((s) => s.currentPlan);
  const awaitingStep = currentPlan?.steps.find((s) => s.status === "awaiting_approval");

  return (
    <CockpitCardShell>
      <div className="flex h-full flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-spatial-xs font-semibold uppercase tracking-[0.2em] text-amber-300/80">
            Validation requise
          </span>
          <span
            className="h-2 w-2 rounded-full"
            style={{
              background: "rgba(232,176,120,0.95)",
              boxShadow: "0 0 12px rgba(232,176,120,0.7)",
            }}
          />
        </div>

        <div className="text-spatial-2xl font-extralight tracking-tight text-white/95">
          {awaitingStep?.label ?? "Action en attente"}
        </div>

        <p className="text-spatial-base font-light leading-[1.65] text-white/70">
          Hearst attend votre accord pour continuer. Vérifiez avant validation.
        </p>

        <div className="mt-auto flex items-center gap-3">
          <button
            type="button"
            className="rounded-[16px] px-4 py-2 text-spatial-sm font-light tracking-wide transition-colors"
            style={{
              background: "rgba(232,176,120,0.18)",
              color: "rgba(255,238,213,0.95)",
              border: "1px solid rgba(232,176,120,0.4)",
            }}
          >
            Valider
          </button>
          <button
            type="button"
            className="rounded-[16px] px-4 py-2 text-spatial-sm font-light tracking-wide transition-colors"
            style={{
              background: "rgba(255,255,255,0.04)",
              color: "rgba(255,255,255,0.65)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            Refuser
          </button>
        </div>
      </div>
    </CockpitCardShell>
  );
}
