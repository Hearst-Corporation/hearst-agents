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
import type { RailItem } from "./types";
import { VISION_EASE } from "./types";

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
      <header className="text-center">
        <p className="t-13 tracking-(--tracking-micro) text-(--text-faint)">
          Voice · Mode conversationnel
        </p>
      </header>

      <div className="flex flex-col items-center gap-8 py-12 text-center">
        {/* Sphère inactive */}
        <div
          className="rounded-full border border-(--line-strong) bg-(--surface) opacity-50 shrink-0"
          style={{ width: "var(--space-24)", height: "var(--space-24)" }}
          aria-hidden="true"
        />

        <div className="flex flex-col gap-3">
          <p className="t-15 font-medium text-(--text-muted)">Mode voix non disponible</p>
          <p
            className="t-13 text-(--text-ghost) leading-relaxed"
            style={{ maxWidth: "var(--width-prose-narrow)" }}
          >
            La session vocale temps réel n&apos;est pas encore branchée. Le chat texte couvre les
            mêmes intentions en attendant.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setStageMode({ mode: "chat" })}
          className="vision-btn-primary t-12 px-(--space-5) py-(--space-2) rounded-(--radius-pill) border-0 font-medium"
        >
          Ouvrir le chat texte
        </button>
      </div>
    </motion.section>
  );
}
