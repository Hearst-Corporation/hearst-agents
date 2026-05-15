"use client";

import { useStageStore } from "@/stores/stage";
import { LeftRail } from "../_shell/LeftRail";
import { STAGE_LABELS } from "../_stages/types";

/**
 * Page de test P1 — `localhost:4102/cockpit-x`.
 *
 * Premier livrable visible du port shell visionOS : la LeftRail 88px avec
 * 12 slots cliquables. Centre = placeholder qui affiche le mode actif pour
 * valider que `useStageStore.setMode` fonctionne dans le nouveau contexte.
 *
 * En P2 : ajout de RightRail + FloatingFooter + AmbientLayers.
 * En P4+ : la zone centre rend le stage actif (CockpitStage puis les autres).
 */
export default function CockpitXPage() {
  const mode = useStageStore((s) => s.current.mode);

  return (
    <div className="flex h-full">
      <LeftRail />
      <main className="flex flex-1 flex-col items-center justify-center gap-4 text-white/50">
        <p className="text-sm uppercase tracking-wider opacity-50">Shell visionOS · P1</p>
        <p className="text-2xl">
          Mode actif&nbsp;: <span className="font-medium text-white">{STAGE_LABELS[mode]}</span>
        </p>
        <p className="text-xs opacity-40">
          {mode === "cockpit"
            ? "Clique sur la LeftRail pour changer de mode."
            : "Mode changé via LeftRail — store hydraté correctement."}
        </p>
      </main>
    </div>
  );
}
