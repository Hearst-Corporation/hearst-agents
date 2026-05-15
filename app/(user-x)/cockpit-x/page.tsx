"use client";

import { motion } from "framer-motion";
import { useStageStore } from "@/stores/stage";
import { Shell } from "../_shell/Shell";
import { STAGE_REGISTRY } from "../_stages/registry";
import type { RailItem } from "../_stages/types";

/**
 * Page de test P3 — `localhost:4102/cockpit-x`.
 *
 * Lit le mode actif via `useStageStore` puis résout le `StageDef`
 * correspondant dans `STAGE_REGISTRY`. Le footer et le railTitle sont
 * désormais alimentés par le registry (preview du système qui sera
 * complet en P4+ quand chaque stage data-bound rendra son contenu).
 *
 * Le centre reste un placeholder en P3 — affiche juste le label + hotkey
 * du mode actif. En P4+ il deviendra `centerContent={<StageRouter />}`
 * qui rendra le composant Stage correspondant.
 *
 * Les `railItems` restent stub (registry ne fournit pas de data — chaque
 * stage en P4+ injecte ses propres items via la prop railItems).
 */

const PLACEHOLDER_RAIL_ITEMS: readonly RailItem[] = [
  { t: "Aucun signal", s: "Connecte un service pour démarrer" },
  { t: "Aucun rendez-vous", s: "Agenda du jour vide" },
  { t: "Aucune mission active", s: "Lance une mission depuis le chat" },
];

export default function CockpitXPage() {
  const mode = useStageStore((s) => s.current.mode);
  const def = STAGE_REGISTRY[mode];

  return (
    <Shell
      centerContent={
        <motion.section
          key={mode}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="preserve-3d flex w-full max-w-[760px] flex-col gap-16"
        >
          <header className="flex flex-col gap-4">
            <p className="text-base font-medium text-[rgba(255,255,255,0.5)]">
              Shell visionOS · P3 · Registry figé
            </p>
            <h1
              className="font-medium leading-[1.1] tracking-tight text-white"
              style={{ fontSize: "var(--text-display)" }}
            >
              {def.label}
              {def.hotkey ? (
                <span className="ml-4 text-base font-normal text-[rgba(255,255,255,0.4)]">
                  {def.hotkey}
                </span>
              ) : null}
            </h1>
            <p className="max-w-[640px] text-base leading-[1.5] text-[rgba(255,255,255,0.7)]">
              Mode <span className="text-white">{mode}</span> sélectionné. Footer + railTitle
              alimentés par <code className="text-[rgba(255,255,255,0.85)]">STAGE_REGISTRY</code>.
              Le contenu data-bound (greeting, hero, activité) arrive en P4+ avec le composant Stage
              dédié.
            </p>
          </header>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="vision-glass preserve-3d relative flex flex-col gap-4 rounded-xl p-10"
          >
            <span className="text-sm text-[rgba(255,255,255,0.5)]">Registry preview</span>
            <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
              <dt className="text-[rgba(255,255,255,0.5)]">railTitle</dt>
              <dd className="text-white">{def.railTitle}</dd>
              <dt className="text-[rgba(255,255,255,0.5)]">footer.status</dt>
              <dd className="text-white">{def.footer.status}</dd>
              <dt className="text-[rgba(255,255,255,0.5)]">footer.actions</dt>
              <dd className="text-white">{def.footer.actions.join(" · ")}</dd>
              <dt className="text-[rgba(255,255,255,0.5)]">footer.modes</dt>
              <dd className="text-white">{def.footer.modes.join(" · ")}</dd>
            </dl>
          </motion.div>
        </motion.section>
      }
      railTitle={def.railTitle}
      railItems={PLACEHOLDER_RAIL_ITEMS}
      footer={def.footer}
    />
  );
}
