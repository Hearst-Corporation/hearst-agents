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
 * RightRail — contexte du stage actif, compact en desktop moyen.
 *
 * Port enrichi de `lab/cli-os/src/components/RightRail.tsx` :
 * - Bordure subtile sur chaque item (vision-glass)
 * - Hover state progressif (bg + border)
 * - Sous-label en monospace (10px, tracking légère)
 * - Stagger animation conservée (framer-motion)
 */
export function RightRail({ title, items }: RightRailProps) {
  return (
    <aside
      aria-label="Contexte"
      className="vision-rail-right preserve-3d relative z-20 hidden xl:flex xl:w-(--width-rail-right) shrink-0 flex-col gap-2 border-l border-line-strong bg-surface px-5 py-10 2xl:w-(--width-rail-right-wide) 2xl:px-8 2xl:py-14"
    >
      <h3 className="mb-3 pl-3 t-9 font-medium text-text-faint 2xl:mb-4 2xl:pl-4 2xl:t-11">
        {title}
      </h3>
      <motion.div
        key={title}
        variants={RAIL_CONTAINER_VARIANTS}
        initial="hidden"
        animate="show"
        className="flex flex-col gap-2"
      >
        {items.length === 0 ? (
          <p className="px-3 t-9 text-text-ghost 2xl:px-4 2xl:t-11">
            Aucun signal pour l&apos;instant.
          </p>
        ) : (
          items.map((item, idx) => (
            <motion.div
              variants={RAIL_ITEM_VARIANTS}
              key={idx}
              className={`flex flex-col gap-1 rounded-lg border p-3 t-13 transition-colors 2xl:p-4 2xl:t-15 ${
                item.hot
                  ? "border-line-strong bg-bg-elev text-text"
                  : "border-transparent text-text-muted"
              }`}
            >
              <span className="leading-snug">{item.t}</span>
              <span
                className={`t-10 block font-mono tracking-wide ${
                  item.hot ? "text-text-muted" : "text-text-ghost"
                }`}
              >
                {item.s}
              </span>
            </motion.div>
          ))
        )}
      </motion.div>
    </aside>
  );
}
