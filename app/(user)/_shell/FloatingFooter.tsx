"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { FooterConfig } from "../_stages/types";

type FloatingFooterProps = {
  config: FooterConfig;
};

/**
 * FloatingFooter — pill flottante bottom center.
 *
 * Affiche :
 *   1. Status (label + dot, data-bound depuis le stage)
 *   2. Actions interactives (uniquement si `onActionClick` est fourni)
 *   3. Modes interactifs (uniquement si `onModeClick` est fourni)
 *
 * Les zones 2 et 3 sont masquées quand aucun handler n'est défini —
 * évite les boutons morts visibles par l'utilisateur.
 */
export function FloatingFooter({ config }: FloatingFooterProps) {
  const hasActions = Boolean(config.onActionClick);
  const hasModes = Boolean(config.onModeClick);

  const [activeAction, setActiveAction] = useState<string>(config.actions[0]);
  const [activeMode, setActiveMode] = useState<string>(config.modes[0]);

  useEffect(() => {
    setActiveAction(config.actions[0]);
    setActiveMode(config.modes[0]);
  }, [config]);

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

      {/* Zone 2 — Actions (uniquement si handler défini) */}
      {hasActions && (
        <div className="vision-segmented-track flex items-center gap-1 rounded-pill p-1.5">
          {config.actions.map((label) => {
            const active = activeAction === label;
            return (
              <motion.button
                whileTap={{ scale: 0.95 }}
                key={label}
                type="button"
                onClick={() => {
                  setActiveAction(label);
                  config.onActionClick?.(label);
                }}
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
      )}

      {/* Zone 3 — Modes (uniquement si handler défini) */}
      {hasModes && (
        <div className="vision-segmented-track flex items-center gap-1 rounded-pill p-1.5">
          {config.modes.map((label) => {
            const active = activeMode === label;
            return (
              <motion.button
                whileTap={{ scale: 0.95 }}
                key={label}
                type="button"
                onClick={() => {
                  setActiveMode(label);
                  config.onModeClick?.(label);
                }}
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
      )}
    </footer>
  );
}
