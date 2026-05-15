"use client";

import { motion, type Variants } from "framer-motion";
import type { RailItem } from "../_stages/types";

const RAIL_CONTAINER_VARIANTS: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.2 } },
};

const RAIL_ITEM_VARIANTS: Variants = {
  hidden: { opacity: 0, x: 10 },
  show: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const },
  },
};

type RightRailProps = {
  title: string;
  items: readonly RailItem[];
};

/**
 * RightRail — 320px, contexte du stage actif.
 *
 * Port direct de `lab/cli-os/src/scenes/CockpitScene.tsx` (RightRail). Le
 * `title` est l'en-tête du rail (ex: "Aperçu du jour", "Connecteurs"…).
 * Les `items` sont une liste de petites cards `{t, s, hot?}` — un item
 * `hot` reçoit le background plus appuyé.
 *
 * Les items sont stagger-animés à l'apparition (variants framer-motion).
 */
export function RightRail({ title, items }: RightRailProps) {
  return (
    <aside
      aria-label="Contexte"
      className="vision-rail-right preserve-3d relative z-20 flex w-[320px] shrink-0 flex-col gap-2 border-l border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] px-8 py-14"
    >
      <h3 className="mb-4 pl-4 text-sm font-medium text-[rgba(255,255,255,0.5)]">{title}</h3>
      <motion.div
        variants={RAIL_CONTAINER_VARIANTS}
        initial="hidden"
        animate="show"
        className="flex flex-col gap-2"
      >
        {items.length === 0 ? (
          <p className="px-4 text-sm text-[rgba(255,255,255,0.35)]">Aucun signal pour l'instant.</p>
        ) : (
          items.map((item, idx) => (
            <motion.button
              variants={RAIL_ITEM_VARIANTS}
              whileTap={{ scale: 0.98 }}
              key={`${item.t}-${idx}`}
              type="button"
              className={`group flex items-start gap-4 rounded-lg p-4 text-left text-base transition-colors ${
                item.hot
                  ? "bg-[rgba(255,255,255,0.08)] text-white"
                  : "text-[rgba(255,255,255,0.6)] hover:bg-[rgba(255,255,255,0.04)] hover:text-white"
              }`}
            >
              <span className="leading-snug">
                {item.t}
                <br />
                <span
                  className={`mt-1 block text-sm ${
                    item.hot ? "text-[rgba(255,255,255,0.7)]" : "text-[rgba(255,255,255,0.4)]"
                  }`}
                >
                  {item.s}
                </span>
              </span>
            </motion.button>
          ))
        )}
      </motion.div>
    </aside>
  );
}
