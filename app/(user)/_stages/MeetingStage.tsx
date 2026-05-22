"use client";

/**
 * MeetingStage — consumer passif data-bound du meeting live.
 *
 * Lit `meetingId` depuis useStageStore (mode "meeting"), poll
 * GET /api/v2/meetings/[id] toutes les 5s, affiche transcript,
 * action items et speakers. Pousse des railItems vers shellData
 * pour alimenter le ContextRail.
 *
 * Pas de mockup : si meetingId absent → empty state.
 */

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { StageLayout } from "@/app/(user)/_shell/StageLayout";
import { Action, EmptyState, StageErrorBanner } from "@/app/(user)/components/ui";
import { sanitizeApiError } from "@/app/(user)/lib/sanitize-error";
import { useStageStore } from "@/stores/stage";
import { useStageData } from "@/stores/stage-data";
import type { RailItem } from "./types";
import { VISION_EASE } from "./types";

// ── Variants ─────────────────────────────────────────────────────────────────

const CONTAINER_VARIANTS = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: VISION_EASE } },
};

const BUBBLE_VARIANTS = {
  hidden: { opacity: 0, y: 8 },
  visible: (idx: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: VISION_EASE, delay: Math.min(idx, 8) * 0.06 },
  }),
};

// ── Types API ─────────────────────────────────────────────────────────────────

interface Segment {
  speaker: string | number;
  text: string;
  start: number;
  end: number;
}

interface ActionItem {
  action: string;
  owner?: string;
  deadline?: string;
}

interface MeetingApiResponse {
  meetingId: string;
  status: string;
  transcript: string;
  segments: Segment[];
  actionItems: ActionItem[];
  videoUrl?: string;
  error?: string;
  message?: string;
}

// ── Mode démo (dev only) ─────────────────────────────────────────────────────
// Affiché uniquement en dev quand aucun meeting réel n'est branché, pour
// pouvoir développer le design sans backend. Inchangé en production.

const IS_DEV = process.env.NODE_ENV !== "production";

const DEMO_MEETING_ID = "Revue commerciale · Q2";

const DEMO_MEETING: MeetingApiResponse = {
  meetingId: DEMO_MEETING_ID,
  status: "in_call",
  transcript: "Camille : Merci à tous d'être là. On fait le point sur le pipeline du trimestre.",
  segments: [
    {
      speaker: "Camille",
      text: "Merci à tous d'être là. On fait le point sur le pipeline du trimestre.",
      start: 0,
      end: 7,
    },
    {
      speaker: "Julien",
      text: "Côté nouveaux comptes, on est à dix-huit signatures, soit cent dix pour cent de l'objectif.",
      start: 8,
      end: 19,
    },
    {
      speaker: "Camille",
      text: "Excellent. Et sur le renouvellement des contrats grands comptes ?",
      start: 20,
      end: 26,
    },
    {
      speaker: "Sarah",
      text: "Deux dossiers à risque, je relance les décideurs cette semaine avec une offre ajustée.",
      start: 27,
      end: 37,
    },
    {
      speaker: "Julien",
      text: "Je peux préparer un comparatif tarifaire pour appuyer la négociation si besoin.",
      start: 38,
      end: 46,
    },
    {
      speaker: "Camille",
      text: "Parfait. On valide ça et on synchronise avant vendredi.",
      start: 47,
      end: 53,
    },
  ],
  actionItems: [
    {
      action: "Relancer les deux comptes à risque avec une offre ajustée",
      owner: "Sarah",
      deadline: "Cette semaine",
    },
    {
      action: "Préparer un comparatif tarifaire pour la négociation",
      owner: "Julien",
      deadline: "Avant vendredi",
    },
    {
      action: "Synchroniser l'équipe commerciale sur le pipeline Q2",
      owner: "Camille",
      deadline: "Vendredi",
    },
  ],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Formate un offset en secondes → "MM:SS". */
function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Durée écoulée en secondes depuis un timestamp ISO ou epoch. */
function useElapsed(startRef: React.MutableRefObject<number | null>): string {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  if (startRef.current === null) return "00:00";
  const sec = Math.floor((Date.now() - startRef.current) / 1000);
  return fmtTime(sec);
}

type SpeakerPaletteEntry = { avatarClass: string; nameClass: string };

/** Couleur avatar pseudo-stable par nom de speaker (tokens DS). */
const SPEAKER_PALETTE: SpeakerPaletteEntry[] = [
  { avatarClass: "bg-(--surface-2) text-text", nameClass: "text-text" },
  { avatarClass: "bg-(--accent-llm)/20 text-(--accent-llm)", nameClass: "text-(--accent-llm)" },
  { avatarClass: "bg-(--gold-surface) text-(--gold)", nameClass: "text-(--gold)" },
  {
    avatarClass: "bg-(--accent-teal-surface) text-(--accent-teal)",
    nameClass: "text-(--accent-teal)",
  },
  {
    avatarClass: "bg-(--accent-agent)/20 text-(--accent-agent)",
    nameClass: "text-(--accent-agent)",
  },
];

function speakerPalette(name: string): SpeakerPaletteEntry {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  const fallback = SPEAKER_PALETTE[0] ?? {
    avatarClass: "bg-(--surface-2) text-text",
    nameClass: "text-text",
  };
  return SPEAKER_PALETTE[Math.abs(hash) % SPEAKER_PALETTE.length] ?? fallback;
}

function speakerInitial(name: string | number): string {
  return String(name).trim().slice(0, 1).toUpperCase() || "?";
}

function isLive(status: string): boolean {
  return status === "in_call" || status === "recording";
}

// ── Sub-composants ────────────────────────────────────────────────────────────

function DemoBanner() {
  return (
    <div
      className="t-9 font-mono uppercase tracking-(--tracking-wide)"
      style={{
        alignSelf: "flex-start",
        color: "var(--text-faint)",
        background: "var(--surface-1)",
        padding: "var(--space-1) var(--space-3)",
        borderRadius: "var(--radius-pill, 9999px)",
      }}
    >
      Démo · données fictives (dev)
    </div>
  );
}

/**
 * Badge Live avec pulsation — affiché si meeting en direct.
 */
function LiveBadge({ elapsed }: { elapsed: string }) {
  return (
    <div className="inline-flex items-center gap-1.5">
      <motion.span
        className="inline-block size-(--size-dot) rounded-full bg-(--danger)"
        animate={{ opacity: [1, 0.3, 1] }}
        transition={{ repeat: Infinity, duration: 1, ease: "easeInOut" }}
      />
      <Action variant="primary" tone="danger" size="sm" disabled>
        En direct · {elapsed}
      </Action>
    </div>
  );
}

/**
 * Badge Terminé — affiché si meeting terminé.
 */
function FinishedBadge() {
  return (
    <Action variant="secondary" tone="neutral" size="sm" disabled>
      Terminé
    </Action>
  );
}

function EmptyMeetingState() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, ease: VISION_EASE }}
    >
      <EmptyState
        title="Aucun meeting actif."
        description="Lance ou rejoins un meeting pour voir le transcript en direct."
        className="max-w-(--width-prose-narrow) mx-auto"
      />
    </motion.div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-14 animate-pulse rounded-xl bg-(--surface-1)" />
      ))}
    </div>
  );
}

function TranscriptBubble({ seg, index }: { seg: Segment; index: number }) {
  const name = String(seg.speaker);
  const palette = speakerPalette(name);
  return (
    <motion.div
      custom={index}
      variants={BUBBLE_VARIANTS}
      initial="hidden"
      animate="visible"
      className="flex gap-3 items-start"
    >
      <div
        className={`flex shrink-0 size-8 rounded-full items-center justify-center t-11 font-semibold mt-0.5 ${palette.avatarClass}`}
      >
        {speakerInitial(seg.speaker)}
      </div>
      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
        <div className="flex gap-2 items-baseline">
          <span className={`t-11 font-semibold ${palette.nameClass}`}>{name || "Intervenant"}</span>
          <span className="t-9 text-text-ghost">{fmtTime(seg.start)}</span>
        </div>
        <p className="t-13 text-text-soft leading-relaxed m-0">{seg.text}</p>
      </div>
    </motion.div>
  );
}

function ActionItemsList({ items }: { items: ActionItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 px-5 py-4 rounded-xl border border-(--line) bg-(--surface-1)">
      <p className="t-9 font-semibold uppercase tracking-(--tracking-wide) text-text-faint mb-1">
        Actions requises
      </p>
      {items.map((item, i) => (
        <div key={i} className="flex gap-(--space-2-5) items-start">
          <span className="mt-0.5 size-4 shrink-0 rounded-xs border-2 border-(--accent-teal-border) inline-flex" />
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="t-13 text-text-soft leading-relaxed">{item.action}</span>
            {(item.owner || item.deadline) && (
              <span className="t-9 text-text-ghost">
                {[item.owner, item.deadline].filter(Boolean).join(" · ")}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────

export function MeetingStage({ mode }: { mode: string }) {
  const current = useStageStore((s) => s.current);
  // Normalise "" → null : le LeftRail ouvre avec meetingId="" (pas de meeting
  // actif). Le ?? ne traitant pas "" comme nullish, sans ça la démo dev ne
  // s'activerait jamais via la navigation.
  const realMeetingId = current.mode === "meeting" && current.meetingId ? current.meetingId : null;

  // Mode démo : actif uniquement en dev ET sans meeting réel. Le poll réel
  // reste prioritaire — dès qu'un vrai meeting arrive, la démo disparaît.
  const demoActive = IS_DEV && !realMeetingId;
  const meetingId = realMeetingId ?? (demoActive ? DEMO_MEETING_ID : null);

  const [data, setData] = useState<MeetingApiResponse | null>(demoActive ? DEMO_MEETING : null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Timestamp de début pour le timer live
  const startedAt = useRef<number | null>(null);
  const elapsed = useElapsed(startedAt);

  // Bottom ref pour auto-scroll transcript
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Fetch + polling 5s
  useEffect(() => {
    if (demoActive) {
      // Pas de poll réseau : on injecte le meeting démo et on amorce le timer.
      setData(DEMO_MEETING);
      setError(null);
      setLoading(false);
      if (startedAt.current === null) startedAt.current = Date.now();
      return;
    }

    if (!meetingId) {
      setData(null);
      setError(null);
      return;
    }

    let cancelled = false;

    async function fetchMeeting() {
      try {
        const res = await fetch(`/api/v2/meetings/${meetingId}`, { credentials: "include" });
        if (cancelled) return;
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { message?: string };
          setError(body.message ?? `Erreur ${res.status}`);
          setLoading(false);
          return;
        }
        const json = (await res.json()) as MeetingApiResponse;
        if (cancelled) return;
        setData(json);
        setError(null);
        // Initialise le timer dès le premier fetch réussi
        if (startedAt.current === null) {
          startedAt.current = Date.now();
        }
      } catch (e) {
        if (!cancelled) setError(sanitizeApiError(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    setLoading(true);
    fetchMeeting();

    const interval = setInterval(fetchMeeting, 5_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [meetingId, demoActive]);

  // Auto-scroll vers le bas quand le transcript grandit
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [data?.segments?.length]);

  // Push railItems → ContextRail
  useEffect(() => {
    if (!data) {
      useStageData.getState().clearShellData();
      return;
    }

    const { segments = [], actionItems = [], status } = data;

    // Speakers uniques actifs
    const uniqueSpeakers = [...new Set(segments.map((s) => String(s.speaker)).filter(Boolean))];

    const items: RailItem[] = [
      // Speakers actifs
      ...uniqueSpeakers.slice(0, 3).map((name) => ({
        t: name,
        s: "intervenant",
        hot: isLive(status),
      })),
      // Action items count
      ...(actionItems.length > 0
        ? [
            {
              t: `${actionItems.length} action${actionItems.length > 1 ? "s" : ""}`,
              s: "Action requise",
              hot: false,
            },
          ]
        : []),
      // Source
      {
        t: "Recall.ai",
        s: isLive(status) ? "En direct" : "Terminé",
        hot: isLive(status),
      },
    ];

    useStageData.getState().setShellData("Meeting · En direct", items);

    return () => {
      useStageData.getState().clearShellData();
    };
  }, [data]);

  // ── Render ────────────────────────────────────────────────────────────────

  const live = data ? isLive(data.status) : false;
  const segments = data?.segments ?? [];
  const actionItems = data?.actionItems ?? [];

  return (
    <motion.section
      key={mode}
      variants={CONTAINER_VARIANTS}
      initial="hidden"
      animate="visible"
      className="preserve-3d flex w-full flex-col gap-16"
    >
      {/* Empty state */}
      {!meetingId && <EmptyMeetingState />}

      {/* Content */}
      {meetingId && (
        <>
          {demoActive && <DemoBanner />}

          <StageLayout
            eyebrow={
              data
                ? `Recall.ai · ${segments.length} segment${segments.length !== 1 ? "s" : ""}`
                : "Connexion…"
            }
            title={data?.meetingId ?? meetingId}
            subtitle={
              data
                ? `${[...new Set(segments.map((s) => String(s.speaker)).filter(Boolean))].length} speaker${
                    [...new Set(segments.map((s) => String(s.speaker)).filter(Boolean))].length !==
                    1
                      ? "s"
                      : ""
                  }${actionItems.length > 0 ? ` · ${actionItems.length} action${actionItems.length > 1 ? "s" : ""} extraites` : ""}`
                : undefined
            }
            actions={live ? <LiveBadge elapsed={elapsed} /> : data ? <FinishedBadge /> : undefined}
          >
            {/* Loading */}
            {loading && !data && <LoadingSkeleton />}

            {/* Error */}
            {error && <StageErrorBanner message={error} />}

            {/* Transcript */}
            <AnimatePresence initial={false}>
              {segments.length > 0 && (
                <div className="flex flex-col gap-5">
                  {segments.map((seg, idx) => (
                    <TranscriptBubble key={`${seg.speaker}-${seg.start}`} seg={seg} index={idx} />
                  ))}
                </div>
              )}
            </AnimatePresence>

            {/* Action items */}
            <ActionItemsList items={actionItems} />

            {/* Sentinel auto-scroll */}
            <div ref={bottomRef} aria-hidden="true" />
          </StageLayout>
        </>
      )}
    </motion.section>
  );
}
