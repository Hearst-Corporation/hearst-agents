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
import { useStageStore } from "@/stores/stage";
import { useStageData } from "@/stores/stage-data";
import type { RailItem } from "./types";

// ── Variants ─────────────────────────────────────────────────────────────────

const VISION_EASE = [0.22, 1, 0.36, 1] as const;

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
          <span style={{ fontSize: "12px", fontWeight: 600, color }}>{name || "Intervenant"}</span>
          <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>
            {fmtTime(seg.start)}
          </span>
        </div>
        <p
          style={{
            fontSize: "14px",
            color: "rgba(255,255,255,0.82)",
            lineHeight: 1.55,
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
        style={{
          fontSize: "11px",
          fontWeight: 600,
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
            <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.82)", lineHeight: 1.5 }}>
              {item.action}
            </span>
            {(item.owner || item.deadline) && (
              <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>
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
  const meetingId = current.mode === "meeting" ? current.meetingId : null;

  const [data, setData] = useState<MeetingApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Timestamp de début pour le timer live
  const startedAt = useRef<number | null>(null);
  const elapsed = useElapsed(startedAt);

  // Bottom ref pour auto-scroll transcript
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Fetch + polling 5s
  useEffect(() => {
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
        if (!cancelled) setError(e instanceof Error ? e.message : "Erreur réseau");
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
  }, [meetingId]);

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
          {/* Header */}
          <header style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <p
              style={{
                fontSize: "12px",
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
