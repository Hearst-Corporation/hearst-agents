"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import type { FooterConfig } from "../_stages/types";

type FloatingFooterProps = {
  config: FooterConfig;
};

/**
 * FloatingFooter — pill flottante 3 zones, ancrée bottom center.
 *
 * Zones (gauche → droite) :
 *   1. Status (label + icône, statique en P2 — animé selon `statusRunning` en P4+)
 *   2. Segmented control 3 actions (`config.actions`)
 *   3. Segmented control 2 modes (`config.modes`)
 *
 * Port direct de `lab/cli-os/src/scenes/CockpitScene.tsx` (FloatingFooter).
 * Les états `activeAction` et `activeMode` sont locaux en P2 — branchés
 * sur des handlers en P4+ quand chaque stage aura sa logique propre.
 */
export function FloatingFooter({ config }: FloatingFooterProps) {
  const [activeAction, setActiveAction] = useState<string>(config.actions[0]);
  const [activeMode, setActiveMode] = useState<string>(config.modes[0]);

  return (
    <footer
      aria-label="Actions cockpit"
      className="vision-glass preserve-3d vision-footer-float absolute bottom-8 left-1/2 z-30 flex w-max items-center gap-12 rounded-pill px-8 py-5"
    >
      {/* Zone 1 — Status */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-3 text-base font-medium text-[rgba(255,255,255,0.7)]">
          <span
            aria-hidden
            className={`block size-2 rounded-full ${
              config.statusRunning ? "animate-pulse bg-white/80" : "bg-[rgba(255,255,255,0.4)]"
            }`}
          />
          <span>{config.status}</span>
        </div>
      </div>

      {/* Zone 2 — Segmented control 3 actions */}
      <div className="vision-segmented-track flex items-center gap-1 rounded-pill p-1.5">
        {config.actions.map((label) => {
          const active = activeAction === label;
          return (
            <motion.button
              whileTap={{ scale: 0.95 }}
              key={label}
              type="button"
              onClick={() => setActiveAction(label)}
              aria-pressed={active}
              className={`rounded-pill px-6 py-2 text-sm transition-colors ${
                active
                  ? "vision-btn-glass text-white"
                  : "text-[rgba(255,255,255,0.5)] hover:text-white"
              }`}
            >
              {label}
            </motion.button>
          );
        })}
      </div>

      {/* Zone 3 — Segmented control 2 modes */}
      <div className="vision-segmented-track flex items-center gap-1 rounded-pill p-1.5">
        {config.modes.map((label) => {
          const active = activeMode === label;
          return (
            <motion.button
              whileTap={{ scale: 0.95 }}
              key={label}
              type="button"
              onClick={() => setActiveMode(label)}
              aria-pressed={active}
              className={`rounded-pill px-6 py-2 text-sm font-medium transition-all ${
                active ? "vision-btn-primary" : "text-[rgba(255,255,255,0.5)] hover:text-white"
              }`}
            >
              {label}
            </motion.button>
          );
        })}
      </div>
    </footer>
  );
}
