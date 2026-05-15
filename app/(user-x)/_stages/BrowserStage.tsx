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

const ITEM_VARIANTS: Variants = {
  hidden: { opacity: 0, x: -8 },
  show: { opacity: 1, x: 0, transition: { duration: 0.3, ease: "easeOut" } },
};

// ── Constantes ────────────────────────────────────────────────────────────────

const BROWSER_TYPES = ["browser_action", "screenshot", "step_complete"] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTimeFR(timestamp: number): string {
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(timestamp));
}

// ── Props ─────────────────────────────────────────────────────────────────────

type Props = { mode: string };

// ── Composant ─────────────────────────────────────────────────────────────────

export function BrowserStage({ mode }: Props) {
  const events = useRuntimeStore((s) => s.events);

  const browserEvents = events.filter((e) => (BROWSER_TYPES as readonly string[]).includes(e.type));

  // Dernier event browser_action avec une URL
  const lastUrlEvent = [...events]
    .filter((e) => e.type === "browser_action")
    .find((e) => (e as { url?: string }).url !== undefined);
  const currentUrl =
    lastUrlEvent !== undefined
      ? ((lastUrlEvent as { url?: string }).url ?? "URL inconnue")
      : "URL inconnue";

  // Dernier screenshot
  const lastScreenshot = events.find((e) => e.type === "screenshot");
  const screenshotUrl =
    lastScreenshot !== undefined ? ((lastScreenshot as { url?: string }).url ?? null) : null;

  // 5 derniers browser_action
  const lastActions = events.filter((e) => e.type === "browser_action").slice(0, 5);

  // Steps Stagehand
  const stepEvents = events.filter((e) => e.type === "step_complete");

  // ── Empty state ────────────────────────────────────────────────────────────

  if (browserEvents.length === 0) {
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
            Aucune session browser active. Lance une mission avec navigation web.
          </p>
        </div>
      </motion.section>
    );
  }

  // ── Rendu principal ────────────────────────────────────────────────────────

  return (
    <motion.section
      key={mode}
      variants={SECTION_VARIANTS}
      initial="hidden"
      animate="show"
      className="preserve-3d flex w-full max-w-[760px] flex-col gap-16"
    >
      {/* Header — URL active */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-white/40">URL active</p>
        <p
          className="truncate rounded-lg px-3 py-2 text-sm text-white/80"
          style={{ background: "rgba(255,255,255,0.05)" }}
        >
          {currentUrl}
        </p>
      </div>

      {/* Zone screenshot */}
      <div className="flex flex-col gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-white/40">Capture écran</p>
        {screenshotUrl !== null ? (
          <img
            src={screenshotUrl}
            alt="Capture écran browser"
            className="aspect-video w-full rounded-xl object-cover"
            style={{ background: "rgba(255,255,255,0.04)" }}
          />
        ) : (
          <div
            className="aspect-video w-full rounded-xl flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.04)" }}
          >
            <p className="text-sm text-white/30">Capture en attente</p>
          </div>
        )}
      </div>

      {/* Liste des dernières actions */}
      {lastActions.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-medium uppercase tracking-wide text-white/40">
            Dernières actions
          </p>
          <motion.ul
            variants={{ show: { transition: { staggerChildren: 0.06 } } }}
            initial="hidden"
            animate="show"
            className="flex flex-col gap-2"
          >
            {lastActions.map((ev, idx) => {
              const action = (ev as { action?: string }).action ?? "action";
              return (
                <motion.li
                  key={idx}
                  variants={ITEM_VARIANTS}
                  className="flex items-center justify-between gap-4 rounded-lg px-3 py-2"
                  style={{ background: "rgba(255,255,255,0.04)" }}
                >
                  <span className="text-sm text-white/75">{action}</span>
                  <span className="shrink-0 text-xs tabular-nums text-white/35">
                    {formatTimeFR(ev.timestamp)}
                  </span>
                </motion.li>
              );
            })}
          </motion.ul>
        </div>
      )}

      {/* Steps Stagehand */}
      {stepEvents.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-medium uppercase tracking-wide text-white/40">
            Étapes complétées
          </p>
          <ul className="flex flex-col gap-2">
            {stepEvents.map((ev, idx) => {
              const label = (ev as { label?: string }).label ?? "Étape";
              return (
                <li key={idx} className="flex items-center gap-3 text-sm">
                  <span
                    className="shrink-0 text-base"
                    style={{ color: "rgba(94,229,195,0.9)" }}
                    aria-hidden
                  >
                    ✓
                  </span>
                  <span className="text-white/70">{label}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </motion.section>
  );
}
