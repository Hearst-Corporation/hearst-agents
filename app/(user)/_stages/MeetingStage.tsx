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

/** Couleur avatar pseudo-stable par nom de speaker. */
const SPEAKER_PALETTE = [
  { bg: "rgba(255,255,255,.15)", color: "rgba(255,255,255,.9)" },
  { bg: "rgba(140,100,255,.2)", color: "rgba(187, 158, 255, 1)" },
  { bg: "rgba(255,188,58,.2)", color: "rgba(255, 188, 58, 1)" },
  { bg: "rgba(94,229,195,.2)", color: "rgba(94,229,195,.9)" },
  { bg: "rgba(255,120,80,.2)", color: "rgba(255, 144, 96, 1)" },
];

function speakerColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  const fallback = { bg: "rgba(255,255,255,.15)", color: "rgba(255,255,255,.9)" };
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
      className="t-9 font-mono uppercase tracking-wide"
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

function EmptyMeetingState() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, ease: VISION_EASE }}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "80px 0",
        textAlign: "center",
      }}
    >
      <p
        className="t-15"
        style={{ color: "rgba(255,255,255,0.45)", maxWidth: "440px", lineHeight: 1.6 }}
      >
        Lance ou rejoins un meeting pour voir le transcript en direct.
      </p>
    </motion.div>
  );
}

function LoadingSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="animate-pulse"
          style={{
            height: "56px",
            borderRadius: "12px",
            background: "rgba(255,255,255,0.05)",
          }}
        />
      ))}
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: VISION_EASE }}
      style={{
        padding: "14px 18px",
        borderRadius: "12px",
        background: "rgba(255,80,80,0.08)",
        borderLeft: "2px solid rgba(255,120,120,0.55)",
        color: "rgba(255,200,200,0.85)",
        fontSize: "13px",
        lineHeight: 1.55,
      }}
    >
      <strong style={{ color: "rgba(255,180,180,0.95)", fontWeight: 600 }}>Erreur</strong> —{" "}
      {message}
    </motion.div>
  );
}

function TranscriptBubble({ seg, index }: { seg: Segment; index: number }) {
  const name = String(seg.speaker);
  const { bg, color } = speakerColor(name);
  return (
    <motion.div
      custom={index}
      variants={BUBBLE_VARIANTS}
      initial="hidden"
      animate="visible"
      style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}
    >
      {/* Avatar */}
      <div
        style={{
          flexShrink: 0,
          width: "32px",
          height: "32px",
          borderRadius: "50%",
          background: bg,
          color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "12px",
          fontWeight: 600,
          marginTop: "2px",
        }}
      >
        {speakerInitial(seg.speaker)}
      </div>
      {/* Body */}
      <div style={{ display: "flex", flexDirection: "column", gap: "3px", flex: 1 }}>
        <div style={{ display: "flex", gap: "8px", alignItems: "baseline" }}>
          <span className="t-11 font-semibold" style={{ color }}>
            {name || "Intervenant"}
          </span>
          <span className="t-11" style={{ color: "rgba(255,255,255,0.35)" }}>
            {fmtTime(seg.start)}
          </span>
        </div>
        <p
          className="t-13"
          style={{
            color: "rgba(255,255,255,0.82)",
            lineHeight: "var(--leading-comfortable)",
            margin: 0,
          }}
        >
          {seg.text}
        </p>
      </div>
    </motion.div>
  );
}

function ActionItemsList({ items }: { items: ActionItem[] }) {
  if (items.length === 0) return null;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        padding: "16px 20px",
        borderRadius: "14px",
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      <p
        className="t-11 font-semibold"
        style={{
          color: "rgba(255,255,255,0.4)",
          letterSpacing: ".06em",
          marginBottom: "4px",
        }}
      >
        Actions requises
      </p>
      {items.map((item, i) => (
        <div key={i} style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
          <span
            style={{
              marginTop: "2px",
              width: "16px",
              height: "16px",
              borderRadius: "4px",
              border: "1.5px solid rgba(94,229,195,0.45)",
              flexShrink: 0,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <span
              className="t-13"
              style={{ color: "rgba(255,255,255,0.82)", lineHeight: "var(--leading-body-tight)" }}
            >
              {item.action}
            </span>
            {(item.owner || item.deadline) && (
              <span className="t-11" style={{ color: "rgba(255,255,255,0.35)" }}>
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
        <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
          {demoActive && <DemoBanner />}

          {/* Header */}
          <header style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <p
              className="t-11"
              style={{
                color: "rgba(255,255,255,0.35)",
                letterSpacing: ".06em",
              }}
            >
              {data
                ? `Recall.ai · ${segments.length} segment${segments.length !== 1 ? "s" : ""}`
                : "Connexion…"}
            </p>
            <h1
              style={{
                fontSize: "28px",
                fontWeight: 500,
                letterSpacing: "-.02em",
                display: "flex",
                alignItems: "center",
                gap: "14px",
                flexWrap: "wrap",
              }}
            >
              {data?.meetingId ?? meetingId}
              {live && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "12px",
                    fontWeight: 500,
                    color: "rgba(255,90,90,0.9)",
                    padding: "4px 10px",
                    borderRadius: "9999px",
                    background: "rgba(255,80,80,0.12)",
                  }}
                >
                  <motion.span
                    style={{
                      width: "5px",
                      height: "5px",
                      borderRadius: "50%",
                      background: "rgba(255,90,90,0.9)",
                      display: "inline-block",
                    }}
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ repeat: Infinity, duration: 1, ease: "easeInOut" }}
                  />
                  En direct · {elapsed}
                </span>
              )}
              {data && !live && (
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 500,
                    color: "rgba(255,255,255,0.45)",
                    padding: "4px 10px",
                    borderRadius: "9999px",
                    background: "rgba(255,255,255,0.06)",
                  }}
                >
                  Terminé
                </span>
              )}
            </h1>
            {data && (
              <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.45)" }}>
                {[...new Set(segments.map((s) => String(s.speaker)).filter(Boolean))].length}{" "}
                speaker
                {[...new Set(segments.map((s) => String(s.speaker)).filter(Boolean))].length !== 1
                  ? "s"
                  : ""}
                {actionItems.length > 0 &&
                  ` · ${actionItems.length} action${actionItems.length > 1 ? "s" : ""} extraites`}
              </p>
            )}
          </header>

          {/* Loading */}
          {loading && !data && <LoadingSkeleton />}

          {/* Error */}
          {error && <ErrorBanner message={error} />}

          {/* Transcript */}
          <AnimatePresence initial={false}>
            {segments.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
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
        </div>
      )}
    </motion.section>
  );
}
