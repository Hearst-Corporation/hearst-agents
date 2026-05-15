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
 * Affiche toujours les 3 zones (status, actions, modes).
 * Si un handler n'est pas défini, les boutons correspondants sont
 * visuellement inertes (pas de hover, pas de clic) mais restent visibles
 * pour ne pas "casser" le layout attendu par l'utilisateur.
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

      {/* Zone 2 — Actions */}
      <div className="vision-segmented-track flex items-center gap-1 rounded-pill p-1.5">
        {config.actions.map((label) => {
          const active = activeAction === label;
          return (
            <motion.button
              whileTap={hasActions ? { scale: 0.95 } : undefined}
              key={label}
              type="button"
              disabled={!hasActions}
              onClick={() => {
                setActiveAction(label);
                config.onActionClick?.(label);
              }}
              aria-pressed={active}
              className={`rounded-pill px-6 py-2 text-sm transition-colors ${
                active
                  ? "vision-btn-glass text-white"
                  : hasActions
                    ? "text-[rgba(255,255,255,0.5)] hover:text-white"
                    : "text-[rgba(255,255,255,0.25)]"
              }`}
            >
              {label}
            </motion.button>
          );
        })}
      </div>

      {/* Zone 3 — Modes */}
      <div className="vision-segmented-track flex items-center gap-1 rounded-pill p-1.5">
        {config.modes.map((label) => {
          const active = activeMode === label;
          return (
            <motion.button
              whileTap={hasModes ? { scale: 0.95 } : undefined}
              key={label}
              type="button"
              disabled={!hasModes}
              onClick={() => {
                setActiveMode(label);
                config.onModeClick?.(label);
              }}
              aria-pressed={active}
              className={`rounded-pill px-6 py-2 text-sm font-medium transition-all ${
                active
                  ? "vision-btn-primary"
                  : hasModes
                    ? "text-[rgba(255,255,255,0.5)] hover:text-white"
                    : "text-[rgba(255,255,255,0.25)]"
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
