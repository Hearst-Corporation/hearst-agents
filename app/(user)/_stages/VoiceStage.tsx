"use client";

/**
 * VoiceStage — placeholder pour l'intégration WebRTC (OpenAI Realtime).
 *
 * Le store `voice.ts` et le composant `VoicePulse` (root layout) géreront
 * la vraie session WebRTC. Ce stage affiche un état "bientôt disponible"
 * en attendant le branchement.
 */

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
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
  const [voiceState] = useState<"idle">("idle");

  // Push ContextRail — état statique "en attente"
  useEffect(() => {
    const items: RailItem[] = [
      {
        t: "Mode voix",
        s: "Bientôt disponible",
        hot: false,
      },
      {
        t: "WebRTC",
        s: "OpenAI Realtime — en cours d'intégration",
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
      className="preserve-3d flex w-full max-w-[760px] flex-col gap-16"
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
        />

        <div className="flex flex-col gap-3">
          <p className="t-15 font-medium text-[var(--text-muted)]">Mode voix</p>
          <p className="t-13 text-[var(--text-ghost)] max-w-[400px] leading-relaxed">
            La conversation vocale en temps réel avec l&apos;agent arrive prochainement.
            <br />
            En attendant, utilise le chat texte (⌘2).
          </p>
        </div>

        <span className="font-mono t-10 tracking-wide" style={{ color: "rgba(255,255,255,0.25)" }}>
          {voiceState === "idle" ? "INACTIF" : ""}
        </span>
      </div>
    </motion.section>
  );
}
