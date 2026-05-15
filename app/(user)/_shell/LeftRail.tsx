"use client";

import { motion } from "framer-motion";
import { useStageStore } from "@/stores/stage";
import { LEFT_RAIL_ORDER, STAGE_REGISTRY } from "../_stages/registry";
import type { StageKey } from "../_stages/types";

/**
 * LeftRail visionOS — 88px de large, glass, 12 slots cliquables.
 *
 * Port direct de `lab/cli-os/src/scenes/CockpitScene.tsx` (LeftRail). Chaque
 * slot change le `mode` du store via `setMode`. La payload est minimale en
 * P1 (juste `{ mode }` pour les modes sans paramètre) — les modes qui
 * exigent un ID (asset, asset_compare, mission, browser, meeting) gardent
 * le payload existant si déjà présent dans le store ; sinon ils sont stubs.
 */

/** Carré abstrait pour figurer un emplacement icône — neutre en P1. */
function IconSlot({ filled = false }: { filled?: boolean }) {
  return (
    <span
      className={
        filled
          ? "block size-4 rounded-[3px] bg-current opacity-80"
          : "block size-4 rounded-[3px] border border-current opacity-40"
      }
    />
  );
}

/**
 * Construit une payload minimale pour passer à `setMode`. Les modes qui
 * requièrent un ID reprennent le dernier ID connu si dispo, sinon utilisent
 * un placeholder vide ("") qui sera remplacé en P5/P6 quand les stages
 * réels seront branchés.
 */
function buildPayload(mode: StageKey, lastAssetId: string | null, lastMissionId: string | null) {
  switch (mode) {
    case "cockpit":
    case "chat":
    case "browser":
    case "meeting":
    case "kg":
    case "voice":
    case "simulation":
    case "artifact":
    case "signal":
      // Les modes sans ID strict (browser/meeting prennent sessionId
      // optionnel mais la signature exige un string — en P1 on passe "")
      if (mode === "browser") return { mode: "browser" as const, sessionId: "" };
      if (mode === "meeting") return { mode: "meeting" as const, meetingId: "" };
      return { mode } as { mode: typeof mode };
    case "asset":
      return { mode: "asset" as const, assetId: lastAssetId ?? "" };
    case "asset_compare":
      return { mode: "asset_compare" as const, assetIds: [] };
    case "mission":
      return { mode: "mission" as const, missionId: lastMissionId ?? "" };
  }
}

export function LeftRail() {
  const activeMode = useStageStore((s) => s.current.mode);
  const lastAssetId = useStageStore((s) => s.lastAssetId);
  const lastMissionId = useStageStore((s) => s.lastMissionId);
  const setMode = useStageStore((s) => s.setMode);

  return (
    <aside aria-label="Navigation principale" className="relative z-20 h-full w-[88px] shrink-0">
      <div className="vision-glass vision-rail-left preserve-3d flex h-full w-full flex-col items-center gap-3 border-y-0 border-l-0 py-8">
        {/* Brand slot top — laissé vide en P1, l'asset SVG arrive en P2 */}
        <div className="mb-6 size-8" aria-hidden />

        {LEFT_RAIL_ORDER.map((key) => {
          const active = activeMode === key;
          const def = STAGE_REGISTRY[key];
          const label = def.hotkey ? `${def.label} (${def.hotkey})` : def.label;
          return (
            <motion.button
              whileTap={{ scale: 0.9 }}
              key={key}
              type="button"
              onClick={() => setMode(buildPayload(key, lastAssetId, lastMissionId))}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              title={label}
              className={`group relative flex size-14 items-center justify-center rounded-xl transition-all duration-300 ${
                active
                  ? "vision-btn-glass z-10 text-white"
                  : "text-[rgba(255,255,255,0.5)] hover:bg-[rgba(255,255,255,0.06)] hover:text-white"
              }`}
            >
              <IconSlot filled={active} />
            </motion.button>
          );
        })}

        <div className="flex-1" />

        {/* Avatar bottom — placeholder en P1, vraie session en P2 */}
        <div className="mt-4 flex size-12 items-center justify-center rounded-full bg-[rgba(255,255,255,0.15)] text-base text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]">
          <span className="opacity-50">·</span>
        </div>
      </div>
    </aside>
  );
}
