"use client";

/**
 * VoiceStage — surface de la session vocale temps réel.
 *
 * Le moteur WebRTC (OpenAI Realtime) vit dans `VoicePulse`, monté une seule
 * fois au root layout et activé via `useVoiceStore.voiceActive`. Ce Stage
 * pilote ce flag (active à l'entrée, coupe à la sortie) et VISUALISE l'état
 * live du store : phase, niveau micro, transcript. Aucune donnée fictive —
 * tout vient du store alimenté par la session OpenAI réelle.
 */

import { motion } from "framer-motion";
import { useEffect, useRef } from "react";
import { useStageStore } from "@/stores/stage";
import { useStageData } from "@/stores/stage-data";
import { useVoiceStore, type VoicePhase } from "@/stores/voice";
import type { RailItem } from "./types";
import { VISION_EASE } from "./types";

const SECTION_VARIANTS = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: VISION_EASE },
  },
};

const PHASE_LABEL: Record<VoicePhase, string> = {
  idle: "Prêt",
  connecting: "Connexion…",
  listening: "À l'écoute",
  processing: "Réflexion…",
  speaking: "Réponse en cours",
  error: "Erreur",
};

const ROLE_LABEL: Record<string, string> = {
  user: "Toi",
  assistant: "Agent",
  tool_call: "Outil",
  tool_result: "Résultat",
};

export function VoiceStage({ mode }: { mode: string }) {
  const setStageMode = useStageStore((s) => s.setMode);
  const setVoiceActive = useVoiceStore((s) => s.setVoiceActive);
  const reset = useVoiceStore((s) => s.reset);
  const phase = useVoiceStore((s) => s.phase);
  const transcript = useVoiceStore((s) => s.transcript);
  const audioLevel = useVoiceStore((s) => s.audioLevel);
  const error = useVoiceStore((s) => s.error);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Entrée sur le Stage → active le pipeline WebRTC (VoicePulse au root se
  // connecte). Sortie → coupe la session + reset le transcript volatil.
  useEffect(() => {
    setVoiceActive(true);
    return () => {
      setVoiceActive(false);
      reset();
    };
  }, [setVoiceActive, reset]);

  // Auto-scroll transcript au plus récent.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [transcript]);

  // Push ContextRail — état live de la session.
  useEffect(() => {
    const items: RailItem[] = [
      { t: "Session", s: PHASE_LABEL[phase], hot: phase === "listening" || phase === "speaking" },
      { t: "Échanges", s: String(transcript.length), hot: false },
    ];
    if (error) items.push({ t: "Erreur", s: error, hot: true });
    useStageData.getState().setShellData("Voice", items);
    return () => {
      useStageData.getState().clearShellData();
    };
  }, [phase, transcript.length, error]);

  const active = phase === "listening" || phase === "speaking" || phase === "processing";
  // Halo réactif au niveau micro (0..1) — borne haute douce pour rester lisible.
  const haloScale = 1 + Math.min(audioLevel, 1) * 0.35;

  return (
    <motion.section
      key={mode}
      variants={SECTION_VARIANTS}
      initial="hidden"
      animate="show"
      className="preserve-3d flex w-full flex-col"
      style={{ gap: "var(--space-10)" }}
    >
      <header className="flex flex-col" style={{ gap: "var(--space-2)" }}>
        <h2 className="t-28 font-light text-[var(--text)]">Voice</h2>
        <p
          className="t-13 font-light text-[var(--text-ghost)]"
          style={{ lineHeight: "var(--leading-base)" }}
        >
          Session vocale temps réel — parle, l'agent répond et agit.
        </p>
      </header>

      {/* Sphère live réactive au micro */}
      <div
        className="flex flex-col items-center"
        style={{ gap: "var(--space-8)", paddingTop: "var(--space-6)" }}
      >
        <div
          className="relative flex items-center justify-center"
          style={{ width: "160px", height: "160px" }}
        >
          <motion.div
            aria-hidden
            className="absolute rounded-full"
            animate={{ scale: active ? haloScale : 1, opacity: active ? 0.5 : 0.15 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            style={{
              width: "160px",
              height: "160px",
              background:
                phase === "error"
                  ? "color-mix(in srgb, var(--danger) 30%, transparent)"
                  : "color-mix(in srgb, var(--accent-teal) 30%, transparent)",
            }}
          />
          <div
            className="rounded-full border"
            style={{
              width: "120px",
              height: "120px",
              borderColor:
                phase === "error"
                  ? "var(--danger)"
                  : active
                    ? "var(--accent-teal-border)"
                    : "var(--line-strong)",
              background: "var(--surface)",
              transition: "border-color var(--duration-base) var(--ease-standard)",
            }}
          />
        </div>

        <div className="flex flex-col items-center" style={{ gap: "var(--space-2)" }}>
          <p className="t-15 font-medium text-[var(--text-muted)]">{PHASE_LABEL[phase]}</p>
          {error && (
            <p className="t-12 font-light text-[var(--danger)] max-w-[420px] text-center">
              {error}
            </p>
          )}
          {phase === "idle" && !error && (
            <p className="t-12 font-light text-[var(--text-ghost)] max-w-[420px] text-center">
              Connexion à la session vocale… autorise le micro si demandé.
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => setStageMode({ mode: "chat" })}
          className="t-12 font-light text-[var(--text-ghost)] hover:text-[var(--text-faint)] transition-colors"
          style={{
            padding: "var(--space-2) var(--space-5)",
            border: "1px solid var(--border-shell)",
            borderRadius: "var(--radius-pill)",
            background: "transparent",
            cursor: "pointer",
          }}
        >
          Passer au chat texte →
        </button>
      </div>

      {/* Transcript live */}
      <div className="flex flex-col" style={{ gap: "var(--space-3)" }}>
        <span className="t-11 font-light text-[var(--text-ghost)]">Transcript</span>
        {transcript.length === 0 ? (
          <p className="t-13 font-light text-[var(--text-ghost)]">
            Rien encore. Parle pour démarrer la conversation.
          </p>
        ) : (
          <div
            ref={scrollRef}
            className="flex flex-col"
            style={{ gap: "var(--space-3)", maxHeight: "320px", overflowY: "auto" }}
          >
            {transcript.map((entry) => {
              const isUser = entry.role === "user";
              const isTool = entry.role === "tool_call" || entry.role === "tool_result";
              return (
                <article
                  key={entry.id}
                  className="flex flex-col"
                  style={{
                    gap: "var(--space-1)",
                    padding: "var(--space-4) var(--space-5)",
                    background: isUser ? "var(--surface-2)" : "var(--surface-1)",
                    border: "1px solid var(--border-shell)",
                    borderLeft: `2px solid ${
                      entry.status === "error"
                        ? "var(--danger)"
                        : isTool
                          ? "var(--accent-agent)"
                          : isUser
                            ? "var(--border-input)"
                            : "var(--accent-teal-border)"
                    }`,
                    borderRadius: "var(--radius-md)",
                  }}
                >
                  <span className="t-9 font-mono uppercase text-[var(--text-ghost)]">
                    {isTool && entry.toolName
                      ? entry.toolName
                      : (ROLE_LABEL[entry.role] ?? entry.role)}
                  </span>
                  <p
                    className="t-13 font-light text-[var(--text-muted)]"
                    style={{ lineHeight: "var(--leading-base)", whiteSpace: "pre-wrap" }}
                  >
                    {entry.text || (entry.role === "assistant" ? "…" : "")}
                  </p>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </motion.section>
  );
}
