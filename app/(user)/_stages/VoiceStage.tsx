"use client";

/**
 * VoiceStage — surface réservée à la session vocale temps réel.
 *
 * Le mode est rendu visible (présent dans LeftRail + Cmd+K), mais
 * l'intégration WebRTC (OpenAI Realtime) n'est pas encore branchée.
 * On affiche donc un état "non disponible" honnête + CTA redirigeant
 * vers le chat texte (⌘2). Aucun bouton n'est faussement actif.
 */

import { motion } from "framer-motion";
import { useEffect } from "react";
import { useStageStore } from "@/stores/stage";
import { useStageData } from "@/stores/stage-data";
import { StageLayout } from "../_shell/StageLayout";
import { EmptyState } from "../components/ui";
import type { RailItem } from "./types";
import { VISION_EASE } from "./types";

/**
 * Icône microphone SVG simple pour VoiceStage.
 */
function MicrophoneIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path
        d="M16 2C13.2386 2 11 4.23858 11 7V14C11 16.7614 13.2386 19 16 19C18.7614 19 21 16.7614 21 14V7C21 4.23858 18.7614 2 16 2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7 14C7 18.4183 10.5817 22 16 22C21.4183 22 25 18.4183 25 14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 22V28"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 28H20"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Variants ─────────────────────────────────────────────────────────────────

const SECTION_VARIANTS = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: VISION_EASE },
  },
};

// ── Composant principal ──────────────────────────────────────────────────────

export function VoiceStage({ mode }: { mode: string }) {
  const setStageMode = useStageStore((s) => s.setMode);

  // Push ContextRail — état statique "non disponible"
  useEffect(() => {
    const items: RailItem[] = [
      {
        t: "Mode voix",
        s: "Non disponible",
        hot: false,
      },
    ];
    useStageData.getState().setShellData("Voice", items);
    return () => {
      useStageData.getState().clearShellData();
    };
  }, []);

  return (
    <motion.section
      key={mode}
      variants={SECTION_VARIANTS}
      initial="hidden"
      animate="show"
      className="preserve-3d flex w-full flex-col gap-16"
    >
      <StageLayout
        eyebrow="Voice"
        title="Mode conversationnel"
        subtitle="Session vocale temps réel"
      >
        <EmptyState
          icon={<MicrophoneIcon />}
          title="Mode voix non disponible"
          description="La session vocale temps réel n'est pas encore branchée. Le chat texte couvre les mêmes intentions en attendant."
          cta={{
            label: "Ouvrir le chat texte",
            onClick: () => setStageMode({ mode: "chat" }),
          }}
        />
      </StageLayout>
    </motion.section>
  );
}
