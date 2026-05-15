"use client";

/**
 * VoiceStage — consumer data-bound du run vocal.
 *
 * Pattern aligné sur ChatStage : pousse un snapshot du state local dans
 * `useStageData.shellData` à chaque tick pour alimenter le ContextRail.
 *
 * Note WebRTC : l'intégration OpenAI Realtime arrive plus tard (cf.
 * `stores/voice.ts` qui sert la session WebRTC pilotée par VoicePulse au
 * root layout). En attendant, le Stage tourne en mode démo local avec un
 * setInterval qui simule `audioLevel`. Le store voice n'est pas branché ici
 * — on évite de muter une session WebRTC fantôme depuis un consumer visuel.
 */

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
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

const BAR_COUNT = 9;
const BAR_DELAYS = [0, 0.1, 0.2, 0.3, 0.4, 0.35, 0.25, 0.15, 0.05];

// ── Types ────────────────────────────────────────────────────────────────────

type VoiceState = "idle" | "listening" | "processing" | "speaking" | "error";

interface Exchange {
  id: string;
  role: "user" | "agent";
  transcript: string;
  ts: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function stateLabel(state: VoiceState): string {
  switch (state) {
    case "listening":
      return "En écoute";
    case "speaking":
      return "Réponse en cours";
    case "processing":
      return "Traitement";
    case "error":
      return "Erreur";
    case "idle":
    default:
      return "Prêt";
  }
}

function sessionLabel(state: VoiceState): string {
  if (state === "listening" || state === "speaking") return "Session active";
  if (state === "processing") return "Traitement en cours";
  if (state === "error") return "Erreur de session";
  return "Inactif";
}

// ── Sub-composants ───────────────────────────────────────────────────────────

function VoiceSphere({ state }: { state: VoiceState }) {
  const isActive = state === "listening" || state === "speaking";
  return (
    <div className="voice-sphere" data-state={state} style={{ opacity: isActive ? 1 : 0.65 }}>
      <div className="voice-ring" />
      <div className="voice-ring r2" />
      <div className="voice-ring r3" />
      <div className="voice-core" />
    </div>
  );
}

function VoiceBars({ active }: { active: boolean }) {
  return (
    <div className="voice-bars" style={{ opacity: active ? 1 : 0.3 }}>
      {Array.from({ length: BAR_COUNT }, (_, idx) => (
        <div key={idx} className="voB" style={{ animationDelay: `${BAR_DELAYS[idx]}s` }} />
      ))}
    </div>
  );
}

function EmptyVoiceState({ onActivate }: { onActivate: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, ease: VISION_EASE }}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "24px",
        padding: "32px 0",
        textAlign: "center",
      }}
    >
      <p
        className="t-15"
        style={{
          color: "rgba(255,255,255,0.45)",
          maxWidth: "440px",
          lineHeight: 1.6,
        }}
      >
        Tape sur le bouton micro pour parler à l'agent.
      </p>
      <motion.button
        type="button"
        onClick={onActivate}
        whileTap={{ scale: 0.96 }}
        className="vision-btn-primary"
        style={{
          padding: "12px 28px",
          borderRadius: "9999px",
          fontSize: "13px",
          fontWeight: 500,
        }}
      >
        Activer le micro
      </motion.button>
    </motion.div>
  );
}

function TranscriptList({ exchanges }: { exchanges: readonly Exchange[] }) {
  return (
    <div className="voice-transcript">
      {exchanges.map((ex) => (
        <span key={ex.id} className={ex.role === "agent" ? "agent" : undefined}>
          {ex.role === "user" ? "Tu : " : "Agent : "}
          {ex.transcript}
        </span>
      ))}
    </div>
  );
}

// ── Composant principal ──────────────────────────────────────────────────────

export function VoiceStage({ mode }: { mode: string }) {
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [audioLevel, setAudioLevel] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isActive = voiceState === "listening" || voiceState === "speaking";

  // Pousse les railItems dans shellData → ContextRail miroir
  useEffect(() => {
    const items: RailItem[] = [
      {
        t: "OpenAI Realtime",
        s: sessionLabel(voiceState),
        hot: voiceState !== "idle" && voiceState !== "error",
      },
      {
        t: stateLabel(voiceState),
        s: `Niveau audio · ${Math.round(audioLevel * 100)}%`,
      },
      {
        t: "Historique",
        s: `${exchanges.length} échange${exchanges.length > 1 ? "s" : ""} dans la session`,
      },
    ];
    useStageData.getState().setShellData("Voice · Realtime", items);
    return () => {
      useStageData.getState().clearShellData();
    };
  }, [voiceState, audioLevel, exchanges.length]);

  // Démo : simule audioLevel oscillant quand listening/speaking
  useEffect(() => {
    if (!isActive) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setAudioLevel(0);
      return;
    }
    intervalRef.current = setInterval(() => {
      setAudioLevel(0.2 + Math.random() * 0.6);
    }, 200);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isActive]);

  // Cleanup au unmount : retour idle + clear interval
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  const handleActivate = () => {
    setVoiceState("listening");
    setExchanges([
      {
        id: `ex-${Date.now()}`,
        role: "user",
        transcript: "Lance le briefing demain à 8h.",
        ts: Date.now(),
      },
      {
        id: `ex-${Date.now() + 1}`,
        role: "agent",
        transcript:
          "Briefing planifié pour demain matin à 8h. Je prépare le résumé actualités, pipeline commercial et réunions.",
        ts: Date.now() + 1,
      },
    ]);
  };

  const handleStop = () => {
    setVoiceState("idle");
  };

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
          style={{
            fontSize: "12px",
            letterSpacing: ".04em",
            color: "rgba(255,255,255,.45)",
          }}
        >
          Voice · OpenAI Realtime · {sessionLabel(voiceState)}
        </p>
      </header>

      <div className="voice-wrap">
        <VoiceSphere state={voiceState} />

        <div className="voice-state">
          <strong>{stateLabel(voiceState)}</strong>
          {voiceState === "listening" && <span> — vas-y, je t'entends.</span>}
          {voiceState === "speaking" && <span> — réponse en cours de synthèse.</span>}
          {voiceState === "processing" && <span> — l'agent analyse ta requête.</span>}
        </div>

        <VoiceBars active={isActive} />

        {exchanges.length === 0 ? (
          <EmptyVoiceState onActivate={handleActivate} />
        ) : (
          <>
            <TranscriptList exchanges={exchanges} />
            <div style={{ display: "flex", justifyContent: "center", marginTop: "8px" }}>
              <motion.button
                type="button"
                onClick={isActive ? handleStop : handleActivate}
                whileTap={{ scale: 0.96 }}
                className="vision-btn-primary"
                style={{
                  padding: "12px 28px",
                  borderRadius: "9999px",
                  fontSize: "13px",
                  fontWeight: 500,
                }}
              >
                {isActive ? "Arrêter" : "Reprendre"}
              </motion.button>
            </div>
          </>
        )}
      </div>
    </motion.section>
  );
}
