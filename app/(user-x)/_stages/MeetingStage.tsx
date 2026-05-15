"use client";

import type { Variants } from "framer-motion";
import { motion } from "framer-motion";
import { useRuntimeStore } from "@/stores/runtime";

// ── Animations ────────────────────────────────────────────────────────────────

const SECTION_VARIANTS: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  },
};

const LINE_VARIANTS: Variants = {
  hidden: { opacity: 0, x: -8 },
  show: { opacity: 1, x: 0, transition: { duration: 0.3, ease: "easeOut" } },
};

// ── Constantes ────────────────────────────────────────────────────────────────

// Palette de couleurs par index de speaker (4 couleurs max)
const SPEAKER_COLORS: readonly string[] = [
  "rgba(255,255,255,0.9)",
  "rgba(94,229,195,0.9)",
  "rgba(255,215,0,0.8)",
  "rgba(200,160,255,0.8)",
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function getSpeakerColor(speaker: string, speakerMap: Map<string, number>): string {
  if (!speakerMap.has(speaker)) {
    const nextIdx = speakerMap.size % SPEAKER_COLORS.length;
    speakerMap.set(speaker, nextIdx);
  }
  return SPEAKER_COLORS[speakerMap.get(speaker)!];
}

// ── Props ─────────────────────────────────────────────────────────────────────

type Props = { mode: string };

// ── Composant ─────────────────────────────────────────────────────────────────

export function MeetingStage({ mode }: Props) {
  const events = useRuntimeStore((s) => s.events);

  const transcriptLines = events.filter((e) => e.type === "transcript_line");
  const actionItems = events.filter((e) => e.type === "action_item_extracted");

  // ── Empty state ────────────────────────────────────────────────────────────

  if (transcriptLines.length === 0 && actionItems.length === 0) {
    return (
      <motion.section
        key={mode}
        variants={SECTION_VARIANTS}
        initial="hidden"
        animate="show"
        className="preserve-3d flex w-full max-w-[760px] flex-col gap-16"
      >
        <div className="flex flex-col items-center gap-4 py-24">
          <p className="text-center text-sm text-white/35">
            Aucune session meeting active. Le bot rejoint automatiquement les calls détectés dans
            ton agenda.
          </p>
        </div>
      </motion.section>
    );
  }

  // Construire la map speaker → index couleur (ordre d'apparition dans le transcript)
  // On parcourt les lignes dans l'ordre chronologique (events est stocké newest-first)
  const orderedLines = [...transcriptLines].reverse();
  const speakerColorMap = new Map<string, number>();
  for (const ev of orderedLines) {
    const speaker = (ev as { speaker?: string }).speaker;
    if (speaker !== undefined && speaker !== "") {
      getSpeakerColor(speaker, speakerColorMap);
    }
  }

  // 10 dernières lignes (les plus récentes = premiers dans events)
  const lastTenLines = transcriptLines.slice(0, 10).reverse();

  // ── Rendu principal ────────────────────────────────────────────────────────

  return (
    <motion.section
      key={mode}
      variants={SECTION_VARIANTS}
      initial="hidden"
      animate="show"
      className="preserve-3d flex w-full max-w-[760px] flex-col gap-16"
    >
      {/* Header — stats */}
      <div
        className="flex items-center gap-6 rounded-xl px-4 py-3"
        style={{ background: "rgba(255,255,255,0.05)" }}
      >
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-white/40">Lignes transcript</span>
          <span className="text-lg font-semibold tabular-nums text-white/85">
            {transcriptLines.length}
          </span>
        </div>
        <div className="h-8 w-px" style={{ background: "rgba(255,255,255,0.1)" }} aria-hidden />
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-white/40">Action items</span>
          <span className="text-lg font-semibold tabular-nums text-white/85">
            {actionItems.length}
          </span>
        </div>
      </div>

      {/* Transcript */}
      {lastTenLines.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-medium uppercase tracking-wide text-white/40">Transcript</p>
          <motion.ul
            variants={{ show: { transition: { staggerChildren: 0.05 } } }}
            initial="hidden"
            animate="show"
            className="flex flex-col gap-3"
          >
            {lastTenLines.map((ev, idx) => {
              const speaker = (ev as { speaker?: string }).speaker ?? "Inconnu";
              const text = (ev as { text?: string }).text ?? "";
              const color = getSpeakerColor(speaker, speakerColorMap);

              return (
                <motion.li key={idx} variants={LINE_VARIANTS} className="flex gap-3">
                  {/* Speaker chip */}
                  <span
                    className="mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{
                      color,
                      background: "rgba(255,255,255,0.06)",
                      border: `1px solid ${color.replace("0.9", "0.2").replace("0.8", "0.2")}`,
                    }}
                  >
                    {speaker}
                  </span>
                  {/* Texte */}
                  <span className="text-sm leading-relaxed text-white/70">{text}</span>
                </motion.li>
              );
            })}
          </motion.ul>
        </div>
      )}

      {/* Action items */}
      <div className="flex flex-col gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-white/40">Action items</p>
        {actionItems.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {actionItems.map((ev, idx) => {
              const text = (ev as { text?: string }).text ?? "";
              return (
                <li key={idx} className="flex items-start gap-2 text-sm">
                  <span
                    className="mt-0.5 shrink-0 font-medium"
                    style={{ color: "rgba(255,215,0,0.85)" }}
                    aria-hidden
                  >
                    →
                  </span>
                  <span className="text-white/75">{text}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-white/30">Aucun action item extrait pour l&apos;instant.</p>
        )}
      </div>
    </motion.section>
  );
}
