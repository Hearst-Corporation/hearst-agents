"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { AmbientSignal } from "@/lib/cockpit/ambient-signals";

const SECTION_VARIANTS = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } },
};

const LIST_VARIANTS = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07, delayChildren: 0.15 } },
};

const ITEM_VARIANTS = {
  hidden: { opacity: 0, x: -8 },
  show: { opacity: 1, x: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const } },
};

function formatHour(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function sortSignals(signals: AmbientSignal[]): AmbientSignal[] {
  return [...signals]
    .sort((a, b) => {
      if (a.severity === b.severity) return 0;
      return a.severity === "warning" ? -1 : 1;
    })
    .slice(0, 5);
}

type Props = { mode?: string };

export function SignalStage({ mode = "signals" }: Props) {
  const [data, setData] = useState<AmbientSignal[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch("/api/v2/cockpit/signals?range=1h")
      .then((r) => r.json())
      .then((json: { signals: AmbientSignal[] }) => {
        if (!cancelled) {
          setData(json.signals ?? []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setData(null);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const sorted = data ? sortSignals(data) : [];
  const headerLabel = loading
    ? "Chargement…"
    : data === null
      ? "Aucun signal récupéré."
      : data.length === 0
        ? "Aucun signal"
        : `${data.length} signal${data.length > 1 ? "s" : ""}`;

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
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-white/5" />
          ))}
        </div>
      ) : data === null ? (
        <p className="text-sm text-white/40">Aucun signal récupéré.</p>
      ) : sorted.length === 0 ? (
        <p className="text-sm text-white/40">Aucun signal à cet instant. Tout semble calme.</p>
      ) : (
        <motion.div
          variants={LIST_VARIANTS}
          initial="hidden"
          animate="show"
          className="flex flex-col gap-3"
        >
          {sorted.map((signal) => {
            const isWarning = signal.severity === "warning";
            return (
              <motion.div
                key={signal.id}
                variants={ITEM_VARIANTS}
                className={`flex items-start gap-4 rounded-xl px-5 py-4 ${
                  isWarning
                    ? "border border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.06)]"
                    : "bg-[rgba(255,255,255,0.03)]"
                }`}
              >
                <span
                  aria-label={isWarning ? "Alerte" : "Info"}
                  className={`mt-0.5 shrink-0 text-base font-mono ${
                    isWarning ? "text-white/80" : "text-white/40"
                  }`}
                >
                  {isWarning ? "!" : "~"}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-sm leading-snug text-white/80">{signal.narration}</span>
                  <span className="text-xs text-white/35">{formatHour(signal.detectedAt)}</span>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </motion.section>
  );
}
