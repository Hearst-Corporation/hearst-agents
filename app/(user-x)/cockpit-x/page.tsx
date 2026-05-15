"use client";

import { motion } from "framer-motion";
import { useStageStore } from "@/stores/stage";
import { Shell } from "../_shell/Shell";
import type { FooterConfig, RailItem } from "../_stages/types";
import { STAGE_LABELS } from "../_stages/types";

/**
 * Page de test P2 — `localhost:4102/cockpit-x`.
 *
 * Coquille complète visionOS : LeftRail + Center placeholder + RightRail
 * + FloatingFooter + AmbientLayers + perspective 3D. Le contenu central
 * reste un placeholder qui affiche le mode actif — les stages réels
 * arrivent en P4+ (CockpitStage d'abord, puis 11 autres en P5/P6).
 *
 * RightRail et FloatingFooter ont des stubs neutres en P2 — ils seront
 * pilotés par le registry en P4+.
 */

const PLACEHOLDER_RAIL: readonly RailItem[] = [
  { t: "Aucun signal", s: "Connecte un service pour démarrer" },
  { t: "Aucun rendez-vous", s: "Agenda du jour vide" },
  { t: "Aucune mission active", s: "Lance une mission depuis le chat" },
];

const PLACEHOLDER_FOOTER: FooterConfig = {
  status: "Shell visionOS · P2",
  statusRunning: false,
  actions: ["Brief", "Activité", "Calme"] as const,
  modes: ["Autonome", "Confirme"] as const,
};

export default function CockpitXPage() {
  const mode = useStageStore((s) => s.current.mode);

  return (
    <Shell
      centerContent={
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="preserve-3d flex w-full max-w-[760px] flex-col gap-16"
        >
          <header className="flex flex-col gap-4">
            <p className="text-base font-medium text-[rgba(255,255,255,0.5)]">
              Shell visionOS · P2
            </p>
            <h1
              className="font-medium leading-[1.1] tracking-tight text-white"
              style={{ fontSize: "var(--text-display)" }}
            >
              Coquille complète, prête pour les stages.
            </h1>
            <p className="max-w-[640px] text-base leading-[1.5] text-[rgba(255,255,255,0.7)]">
              Mode actif&nbsp;: <span className="text-white">{STAGE_LABELS[mode]}</span>. Le centre
              reste un placeholder — les 12 stages polymorphes seront branchés en P4+ (CockpitStage
              d'abord, puis les 11 autres en parallèle).
            </p>
          </header>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="vision-glass preserve-3d relative flex flex-col gap-4 rounded-xl p-10"
          >
            <span className="text-sm text-[rgba(255,255,255,0.5)]">Vérification visuelle</span>
            <p className="text-base leading-[1.6] text-[rgba(255,255,255,0.7)]">
              Tu dois voir : LeftRail 88px à gauche, RightRail 320px à droite, pill flottante en bas
              centrée, halo blanc doux + dots teal en arrière-plan. La perspective 3D fait reculer
              le contenu de 15px. Clique sur la LeftRail pour changer de mode.
            </p>
          </motion.div>
        </motion.section>
      }
      railTitle="Aperçu (P2 — stub)"
      railItems={PLACEHOLDER_RAIL}
      footer={PLACEHOLDER_FOOTER}
    />
  );
}
