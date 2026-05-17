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

// ── Variants ─────────────────────────────────────────────────────────────────

const VISION_EASE = [0.22, 1, 0.36, 1] as const;

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
      <header style={{ textAlign: "center" }}>
        <p
          className="t-13"
          style={{
            letterSpacing: ".04em",
            color: "rgba(255,255,255,.45)",
          }}
        >
          Voice · Mode conversationnel
        </p>
      </header>

      <div
        className="flex flex-col items-center gap-8"
        style={{ padding: "48px 0", textAlign: "center" }}
      >
        {/* Sphère inactive */}
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: "50%",
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.02)",
            opacity: 0.5,
          }}
          aria-hidden="true"
        />

        <div className="flex flex-col gap-3">
          <p className="t-15 font-medium text-[var(--text-muted)]">Mode voix non disponible</p>
          <p className="t-13 text-[var(--text-ghost)] max-w-[400px] leading-relaxed">
            La session vocale temps réel n&apos;est pas encore branchée. Le chat texte couvre les
            mêmes intentions en attendant.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setStageMode({ mode: "chat" })}
          className="vision-btn-primary t-12"
          style={{
            padding: "var(--space-2) var(--space-5)",
            borderRadius: "var(--radius-pill)",
            border: "none",
            fontWeight: 500,
          }}
        >
          Ouvrir le chat texte
        </button>
      </div>
    </motion.section>
  );
}
