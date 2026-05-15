"use client";

/**
 * SignalStage — consumer passif data-bound des signaux ambiants.
 *
 * Pattern pilote ChatStage : fetch `/api/v2/cockpit/signals?range=1h`,
 * push top 4 signaux dans `useStageData.shellData` pour le ContextRail,
 * cleanup au unmount.
 *
 * Source de vérité : `lib/cockpit/ambient-signals.ts` (whisper qualitatif —
 * mission failed, OAuth expirée, brief stale, variant timeout, mission
 * silencieuse). Voix FR sourde, pas d'alerte agressive.
 */

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { AmbientSignal, AmbientSignalKind } from "@/lib/cockpit/ambient-signals";
import { useStageData } from "@/stores/stage-data";
import type { RailItem } from "./types";

// ── Variants ─────────────────────────────────────────────────────────────────

const VISION_EASE = [0.22, 1, 0.36, 1] as const;

const SECTION_VARIANTS = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: VISION_EASE } },
};

const LIST_VARIANTS = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.1 } },
};

const ITEM_VARIANTS = {
  hidden: { opacity: 0, x: -8 },
  show: { opacity: 1, x: 0, transition: { duration: 0.35, ease: VISION_EASE } },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Label FR pour la severity ambient. */
function severityLabel(severity: AmbientSignal["severity"]): string {
  return severity === "warning" ? "Alerte" : "Info";
}

/** Label FR pour la source (kind) — utilisé comme `t` du RailItem. */
function kindLabel(kind: AmbientSignalKind): string {
  switch (kind) {
    case "mission_failed":
      return "Mission";
    case "oauth_expired":
      return "Connexion";
    case "brief_stale":
      return "Briefing";
    case "variant_timeout":
      return "Variant";
    case "mission_silent":
      return "Veille";
    default:
      return "Signal";
  }
}

/** Couleur du dot selon severity. */
function dotColor(severity: AmbientSignal["severity"]): string {
  return severity === "warning" ? "rgba(255,140,140,0.85)" : "rgba(255,255,255,0.45)";
}

/** Format heure courte FR. */
function formatHour(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

/** Tri : warning d'abord, puis chronologique décroissant. */
function sortSignals(signals: readonly AmbientSignal[]): AmbientSignal[] {
  return [...signals].sort((a, b) => {
    const sevDiff = (a.severity === "warning" ? 0 : 1) - (b.severity === "warning" ? 0 : 1);
    if (sevDiff !== 0) return sevDiff;
    return Date.parse(b.detectedAt) - Date.parse(a.detectedAt);
  });
}

// ── Sub-composants ───────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-16 animate-pulse rounded-xl bg-white/5" />
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

function EmptyState() {
  return (
    <motion.p
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, ease: VISION_EASE }}
      className="text-sm text-white/40"
    >
      Aucun signal sur la dernière heure. L&apos;agent veille.
    </motion.p>
  );
}

function SignalCard({ signal }: { signal: AmbientSignal }) {
  const isWarning = signal.severity === "warning";
  return (
    <motion.div
      variants={ITEM_VARIANTS}
      className={`flex items-start gap-4 rounded-xl px-5 py-4 ${
        isWarning
          ? "border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.05)]"
          : "bg-[rgba(255,255,255,0.03)]"
      }`}
    >
      <span
        aria-hidden="true"
        className="mt-1.5 inline-block size-2 shrink-0 rounded-full"
        style={{ background: dotColor(signal.severity) }}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-sm leading-snug text-white/85">{signal.narration}</span>
        <div className="flex items-center gap-2 text-xs text-white/35">
          <span>{kindLabel(signal.kind)}</span>
          <span aria-hidden="true">·</span>
          <span>{severityLabel(signal.severity)}</span>
          <span aria-hidden="true">·</span>
          <span>{formatHour(signal.detectedAt)}</span>
        </div>
      </div>
    </motion.div>
  );
}

// ── Composant principal ──────────────────────────────────────────────────────

export function SignalStage({ mode }: { mode: string }) {
  const [signals, setSignals] = useState<AmbientSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch /api/v2/cockpit/signals?range=1h
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch("/api/v2/cockpit/signals?range=1h", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data: { signals?: AmbientSignal[] }) => {
        if (!cancelled) {
          setSignals(sortSignals(data.signals ?? []));
          setLoading(false);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Pousse top 4 signaux dans shellData → ContextRail miroir
  useEffect(() => {
    const warningCount = signals.filter((s) => s.severity === "warning").length;
    const items: RailItem[] = signals.slice(0, 4).map((s) => ({
      t: kindLabel(s.kind),
      s: severityLabel(s.severity),
      hot: s.severity === "warning",
    }));
    const title =
      warningCount > 0
        ? `Connecteurs (${warningCount} alerte${warningCount > 1 ? "s" : ""})`
        : "Connecteurs";
    useStageData.getState().setShellData(title, items);
    return () => {
      useStageData.getState().clearShellData();
    };
  }, [signals]);

  const headerLabel = loading
    ? "Chargement…"
    : error
      ? "Aucun signal récupéré"
      : signals.length === 0
        ? "Aucun signal"
        : `${signals.length} signal${signals.length > 1 ? "s" : ""}`;

  return (
    <motion.section
      key={mode}
      variants={SECTION_VARIANTS}
      initial="hidden"
      animate="show"
      className="preserve-3d flex w-full max-w-[760px] flex-col gap-16"
    >
      {/* Header */}
      <div className="flex flex-col gap-3">
        <h2 className="text-2xl font-semibold text-white/90">{headerLabel}</h2>
        <p className="text-sm text-white/40">Signaux ambiants — dernière heure</p>
      </div>

      {/* Content */}
      {loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <ErrorBanner message={error} />
      ) : signals.length === 0 ? (
        <EmptyState />
      ) : (
        <motion.div
          variants={LIST_VARIANTS}
          initial="hidden"
          animate="show"
          className="flex flex-col gap-3"
        >
          {signals.map((signal) => (
            <SignalCard key={signal.id} signal={signal} />
          ))}
        </motion.div>
      )}
    </motion.section>
  );
}
