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
      className="vision-rail-right preserve-3d relative z-20 flex w-[320px] shrink-0 flex-col gap-2 border-l border-[var(--line-strong)] bg-[var(--surface)] px-8 py-14"
    >
      <h3 className="mb-4 pl-4 text-sm font-medium text-[var(--text-faint)]">{title}</h3>
      <motion.div
        key={title}
        variants={RAIL_CONTAINER_VARIANTS}
        initial="hidden"
        animate="show"
        className="flex flex-col gap-2"
      >
        {items.length === 0 ? (
          <p className="px-4 text-sm text-[var(--text-ghost)]">Aucun signal pour l&apos;instant.</p>
        ) : (
          items.map((item, idx) => (
            <motion.div
              variants={RAIL_ITEM_VARIANTS}
              key={idx}
              className={`flex flex-col gap-1 rounded-lg border p-4 text-base transition-colors ${
                item.hot
                  ? "border-[var(--line-strong)] bg-[var(--bg-elev)] text-white"
                  : "border-transparent text-[var(--text-muted)]"
              }`}
            >
              <span className="leading-snug">{item.t}</span>
              <span
                className={`t-10 block font-mono tracking-wide ${
                  item.hot ? "text-[var(--text-muted)]" : "text-[var(--text-ghost)]"
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
