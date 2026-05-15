"use client";

import { motion } from "framer-motion";
import type { VoicePhase } from "@/stores/voice";
import { useVoiceStore } from "@/stores/voice";

const SECTION_VARIANTS = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } },
};

const PHASE_LABELS: Record<VoicePhase, string> = {
  idle: "Inactif",
  connecting: "Connexion…",
  listening: "En écoute",
  processing: "Comprend…",
  speaking: "Répond",
  error: "Erreur",
};

const BAR_COUNT = 9;

function barBaseHeight(idx: number): number {
  const center = (BAR_COUNT - 1) / 2;
  const dist = Math.abs(idx - center) / center;
  return 4 + (1 - dist) * 10;
}

type Props = { mode?: string };

export function VoiceStage({ mode = "voice" }: Props) {
  const phase = useVoiceStore((s) => s.phase);
  const transcript = useVoiceStore((s) => s.transcript);
  const audioLevel = useVoiceStore((s) => s.audioLevel);

  const lastFive = transcript.slice(-5);
  const isListening = phase === "listening";
  const isSpeaking = phase === "speaking";

  return (
    <motion.section
      key={mode}
      variants={SECTION_VARIANTS}
      initial="hidden"
      animate="show"
      className="preserve-3d flex w-full max-w-[760px] flex-col gap-16"
    >
      {/* Sphère + état */}
      <div className="flex flex-col items-center gap-6">
        <motion.div
          animate={{ scale: isSpeaking ? 1.05 : 1 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className={`size-32 rounded-full ${isListening ? "animate-pulse" : ""}`}
          style={{
            background:
              "radial-gradient(circle at 40% 35%, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.15) 60%, rgba(255,255,255,0.04) 100%)",
            boxShadow:
              phase === "error"
                ? "0 0 40px rgba(255,80,80,0.25)"
                : isListening || isSpeaking
                  ? "0 0 60px rgba(255,255,255,0.2), 0 0 120px rgba(255,255,255,0.08)"
                  : "0 0 24px rgba(255,255,255,0.06)",
          }}
        />

        <p className="text-sm font-medium text-white/60">{PHASE_LABELS[phase]}</p>
      </div>

      {/* Waveform */}
      <div className="flex items-end justify-center gap-1.5" aria-hidden>
        {Array.from({ length: BAR_COUNT }, (_, idx) => {
          const active = audioLevel > 0;
          const targetHeight = active
            ? 4 + audioLevel * (barBaseHeight(idx) * 2)
            : barBaseHeight(idx);

          return (
            <motion.div
              key={idx}
              animate={{ height: targetHeight }}
              transition={{ duration: 0.1, ease: "linear" }}
              className="w-1 rounded-full bg-white/30"
              style={{ minHeight: 4 }}
            />
          );
        })}
      </div>

      {/* Transcript */}
      <div className="flex flex-col gap-3">
        {lastFive.length === 0 && phase === "idle" ? (
          <p className="text-center text-sm text-white/35">Démarre une session vocale avec ⌘7.</p>
        ) : (
          lastFive.map((entry) => {
            const roleStyle =
              entry.role === "user"
                ? "text-white"
                : entry.role === "assistant"
                  ? "text-[rgba(255,255,255,0.7)]"
                  : "text-[rgba(255,255,255,0.4)]";

            const label =
              entry.role === "tool_call" && entry.toolName ? `[${entry.toolName}]` : null;

            return (
              <div key={entry.id} className={`flex flex-col gap-0.5 text-sm ${roleStyle}`}>
                {label && <span className="text-xs font-mono text-white/30">{label}</span>}
                <span className="leading-relaxed">{entry.text}</span>
              </div>
            );
          })
        )}
      </div>
    </motion.section>
  );
}
