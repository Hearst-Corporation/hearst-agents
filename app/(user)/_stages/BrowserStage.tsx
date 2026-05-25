"use client";

/**
 * BrowserStage — consumer data-bound session Browserbase + Stagehand.
 *
 * Lit le `sessionId` depuis `useStageStore` (payload mode="browser") et
 * fetche l'état de session via GET /api/v2/browser/[id].
 *
 * Steps Stagehand : polling vers /api/v2/browser/sessions/[id]/steps
 * (no-op si la route n'existe pas encore — 404 silencieux).
 *
 * Push vers ContextRail : URL courante + étape X/Y + timestamp + mode.
 */

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { EmptyState, StageErrorBanner } from "@/app/(user)/components/ui";
import { sanitizeApiError } from "@/app/(user)/lib/sanitize-error";
import { useStageStore } from "@/stores/stage";
import { useStageData } from "@/stores/stage-data";
import { StageLayout } from "../_shell/StageLayout";
import type { RailItem } from "./types";
import { VISION_EASE } from "./types";

// ── Types ────────────────────────────────────────────────────────────────────

type StepStatus = "pending" | "running" | "done" | "error";

interface BrowserStep {
  id: string;
  label: string;
  status: StepStatus;
}

interface SessionInfo {
  status: string;
  createdAt?: string;
  stoppedAt?: string | null;
  debugViewerUrl?: string | null;
  connectUrl?: string | null;
}

type FetchState = "idle" | "loading" | "ready" | "error";

// ── Constantes / variants ────────────────────────────────────────────────────

const CONTAINER_VARIANTS = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: VISION_EASE },
  },
};

const STEP_VARIANTS = {
  hidden: { opacity: 0, y: 6 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: VISION_EASE, delay: Math.min(i, 8) * 0.07 },
  }),
};

// Étapes Stagehand — alimentées par polling /api/v2/browser/sessions/[id]/steps.
// Tant que la route n'existe pas ou ne renvoie pas de steps, le tableau reste
// vide et l'UI affiche un état honnête "en attente de données".

/** Tableau vide stable (référence module) — évite un nouveau tableau par render. */
const EMPTY_STEPS: BrowserStep[] = [];

// ── Helpers ──────────────────────────────────────────────────────────────────

function stepStateLabel(status: StepStatus): string {
  switch (status) {
    case "done":
      return "Terminé";
    case "running":
      return "Étape en cours";
    case "error":
      return "Erreur";
    case "pending":
    default:
      return "En attente";
  }
}

function stepDotClass(status: StepStatus): string {
  switch (status) {
    case "done":
      return "bg-(--accent-teal)";
    case "running":
      return "bg-(--accent-llm)";
    case "error":
      return "bg-(--danger)";
    case "pending":
    default:
      return "bg-(--text-ghost)/30";
  }
}

function currentStepIndex(steps: BrowserStep[]): number {
  const runIdx = steps.findIndex((s) => s.status === "running");
  if (runIdx !== -1) return runIdx;
  const lastDone = [...steps].reverse().findIndex((s) => s.status === "done");
  if (lastDone !== -1) return steps.length - 1 - lastDone;
  return 0;
}

function doneCount(steps: BrowserStep[]): number {
  return steps.filter((s) => s.status === "done").length;
}

// ── Sub-composants ───────────────────────────────────────────────────────────

function EmptyBrowserState() {
  return (
    <EmptyState
      title="Aucune session active."
      description="Lance une mission de navigation ou demande à l'agent d'ouvrir un navigateur."
      cta={{
        label: "Lancer une navigation",
        onClick: () =>
          useStageStore.getState().setCommandeurOpen(true, { prefilledQuery: "Naviguer vers" }),
      }}
    />
  );
}

function LoadingState() {
  return (
    <motion.div
      role="status"
      aria-live="polite"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: VISION_EASE }}
      className="flex items-center gap-(--space-2-5) py-10 text-(--text-muted) t-13"
    >
      <motion.div
        className="size-1.5 rounded-full bg-(--accent-llm)/90"
        animate={{ opacity: [1, 0.3, 1] }}
        transition={{ repeat: Infinity, duration: 1, ease: "easeInOut" }}
      />
      Connexion à la session…
    </motion.div>
  );
}

function SessionFrame({
  sessionId,
  url,
  sessionInfo,
}: {
  sessionId: string;
  url: string;
  sessionInfo: SessionInfo | null;
}) {
  const isActive = sessionInfo?.status === "RUNNING" || sessionInfo?.status === "running";

  return (
    <div className="rounded-xl overflow-hidden border border-(--line-strong) bg-(--surface)">
      {/* Barre navigateur */}
      <div className="flex items-center gap-(--space-2-5) px-4 py-(--space-2-5) border-b border-(--line-strong) bg-(--bg-soft)">
        {/* Traffic lights */}
        <div className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-(--danger)/45" />
          <span className="size-2.5 rounded-full bg-(--warn)/45" />
          <span className="size-2.5 rounded-full bg-(--accent-teal)/45" />
        </div>

        {/* URL pill */}
        <div className="flex-1 px-3 py-1.5 rounded-lg bg-(--surface-2) t-13 text-(--text-faint) font-mono truncate">
          🔒 {url || `session:${sessionId.slice(0, 8)}…`}
        </div>

        {/* Indicateur live */}
        <div className="flex items-center gap-1.5">
          <motion.div
            className={`size-(--space-1) rounded-full ${isActive ? "bg-(--accent-llm)" : "bg-text-ghost/30"}`}
            animate={isActive ? { opacity: [1, 0.3, 1] } : { opacity: 1 }}
            transition={isActive ? { repeat: Infinity, duration: 1, ease: "easeInOut" } : {}}
          />
          <span className="t-10 text-(--accent-llm)/85">
            {isActive ? "Session active" : "Inactif"}
          </span>
        </div>
      </div>

      {/* Viewport — placeholder aspect-video, PAS d'iframe (XSS / cross-origin) */}
      <div className="aspect-video bg-(--surface-1) flex flex-col items-center justify-center gap-(--space-2-5) rounded-(--radius-sm) border border-(--border-shell)">
        <span className="t-13 text-(--text-ghost)">
          Visualisation du navigateur en cours de développement
        </span>
        <span className="t-11 text-(--text-muted)">Session : {sessionId.slice(0, 16)}…</span>
      </div>
    </div>
  );
}

function StepRow({ step, index }: { step: BrowserStep; index: number }) {
  const isRunning = step.status === "running";
  const isDone = step.status === "done";
  const isError = step.status === "error";
  const isPending = step.status === "pending";

  return (
    <motion.div
      custom={index}
      variants={STEP_VARIANTS}
      initial="hidden"
      animate="visible"
      layout
      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg border transition-[opacity,background,border-color] duration-200 ${
        isRunning
          ? "bg-(--accent-llm)/6 border-(--accent-llm)/15"
          : "border-(--line) bg-transparent"
      } ${isPending ? "opacity-40" : ""}`}
    >
      <div
        className={`size-6 rounded-full flex items-center justify-center t-11 font-semibold shrink-0 ${stepDotClass(step.status)} ${
          isDone || isRunning || isError ? "text-(--text-on-accent-teal)" : "text-text-ghost"
        }`}
      >
        {isDone ? "✓" : isError ? "✕" : isRunning ? "…" : index + 1}
      </div>

      <div className="flex-1 t-13 text-(--text-soft) leading-(--leading-base)">{step.label}</div>

      <span
        className={`t-11 font-medium px-2 py-0.5 rounded-(--radius-pill) shrink-0 ${
          isError
            ? "bg-(--danger)/10 text-(--danger)"
            : isRunning
              ? "bg-(--accent-llm)/15 text-(--accent-llm)"
              : isDone
                ? "bg-(--surface-1) text-(--text-muted)"
                : "text-(--text-muted)"
        }`}
      >
        {stepStateLabel(step.status)}
      </span>
    </motion.div>
  );
}

function ModeToggle({ auto, onToggle }: { auto: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="t-13 text-(--text-muted)">
        {auto ? "Mode automatique" : "Mode pas-à-pas"}
      </span>
      <button
        type="button"
        onClick={onToggle}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-(--line) t-13 font-medium cursor-pointer transition-colors focus-visible:ring-1 focus-visible:ring-(--accent-llm)/50 focus-visible:outline-none ${
          auto ? "bg-(--accent-llm)/12 text-(--accent-llm)" : "bg-(--surface-1) text-(--text-faint)"
        }`}
      >
        {auto ? "Auto" : "Pas-à-pas"}
      </button>
    </div>
  );
}

// ── Composant principal ──────────────────────────────────────────────────────

export function BrowserStage({ mode }: { mode: string }) {
  const payload = useStageStore((s) => s.current);
  // Normalise "" → null : le LeftRail ouvre le Stage avec sessionId="" (pas
  // de session active). "" n'est pas nullish, donc on normalise explicitement.
  const sessionId = payload.mode === "browser" && payload.sessionId ? payload.sessionId : null;

  const [fetchState, setFetchState] = useState<FetchState>("idle");
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const steps: BrowserStep[] = EMPTY_STEPS;
  const [currentUrl, setCurrentUrl] = useState<string>("");
  const [autoMode, setAutoMode] = useState(true);
  const [captureTs, setCaptureTs] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Fetch session info quand sessionId dispo
  useEffect(() => {
    if (!sessionId) {
      setFetchState("idle");
      setSessionInfo(null);
      setFetchError(null);
      return;
    }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setFetchState("loading");
    setFetchError(null);

    fetch(`/api/v2/browser/${sessionId}`, { signal: ctrl.signal })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error ?? `HTTP ${res.status}`);
        }
        return res.json() as Promise<SessionInfo>;
      })
      .then((data) => {
        setSessionInfo(data);
        setCurrentUrl(data.connectUrl ?? data.debugViewerUrl ?? "");
        setFetchState("ready");
        setCaptureTs(
          new Date().toLocaleTimeString("fr-FR", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Europe/Paris",
          }),
        );
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === "AbortError") return;
        setFetchError(sanitizeApiError(err));
        setFetchState("error");
      });

    return () => ctrl.abort();
  }, [sessionId]);

  // Polling des steps Stagehand — déclenché uniquement si une session est active.
  // S'arrête si la session passe dans un état terminal.
  // TODO: dépend SSE backend — la route /api/v2/browser/sessions/[id]/steps
  //   n'existe pas encore. Le squelette est prêt ; remplacer le no-op par le
  //   vrai fetch dès que le backend l'expose.
  useEffect(() => {
    if (!sessionId) return;

    // États terminaux : le polling s'arrête dès qu'un de ces statuts est détecté.
    const TERMINAL_STATUSES = new Set([
      "completed",
      "error",
      "closed",
      "COMPLETED",
      "ERROR",
      "CLOSED",
    ]);

    const controller = new AbortController();

    // Backoff exponentiel : 5s → 10s → 20s → 40s → cap 60s.
    // Réinitialisé à 5s sur réponse ok ; augmenté sur erreur/non-ok.
    const POLL_BASE = 5_000;
    const POLL_CAP = 60_000;
    const delayRef = { current: POLL_BASE };
    const timerRef = { current: undefined as ReturnType<typeof setTimeout> | undefined };
    // Garde "vol en cours" — empêche deux chaînes de polling concurrentes
    // (ex: onglet re-visible pendant qu'un fetch est en await).
    const inFlightRef = { current: false };

    const schedule = () => {
      // Pause onglet inactif : on ne planifie pas si caché.
      if (document.hidden) return;
      timerRef.current = setTimeout(() => void poll(), delayRef.current);
    };

    const poll = async () => {
      // Guard double-scheduling : un seul poll en vol à la fois.
      if (inFlightRef.current) return;
      inFlightRef.current = true;

      // Guard terminal : si la session est déjà dans un état final, on s'arrête.
      if (sessionInfo && TERMINAL_STATUSES.has(sessionInfo.status)) {
        inFlightRef.current = false;
        controller.abort();
        return;
      }

      try {
        // TODO: dépend SSE backend — no-op si 404 (route non encore créée).
        const res = await fetch(`/api/v2/browser/sessions/${sessionId}/steps`, {
          signal: controller.signal,
          credentials: "include",
        });
        if (!res.ok) {
          // Réponse non-ok → backoff exponentiel.
          delayRef.current = Math.min(delayRef.current * 2, POLL_CAP);
          inFlightRef.current = false;
          schedule();
          return;
        }
        // TODO: brancher setSteps() quand /api/v2/browser/sessions/[id]/steps est dispo.
        await res.json();
        // Réponse ok → reset du délai.
        delayRef.current = POLL_BASE;
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          inFlightRef.current = false;
          return;
        }
        // Erreur réseau → backoff exponentiel, polling continue.
        delayRef.current = Math.min(delayRef.current * 2, POLL_CAP);
      }

      inFlightRef.current = false;
      schedule();
    };

    // Reprend le polling immédiatement au retour sur l'onglet.
    // Ne relance que si aucun poll n'est déjà en vol.
    const onVisibilityChange = () => {
      if (!document.hidden && !inFlightRef.current) {
        clearTimeout(timerRef.current);
        void poll();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    void poll(); // appel immédiat au montage

    return () => {
      clearTimeout(timerRef.current);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      controller.abort();
    };
  }, [sessionId, sessionInfo]);

  // Push ContextRail
  useEffect(() => {
    if (!sessionId) {
      useStageData.getState().clearShellData();
      return;
    }

    const done = doneCount(steps);
    const total = steps.length;
    const stepIdx = currentStepIndex(steps);

    const items: RailItem[] = [
      {
        t: "URL courante",
        s: currentUrl || `session:${sessionId.slice(0, 12)}…`,
        hot: false,
      },
      {
        t: "Étape",
        s: `${done} / ${total} — ${steps[stepIdx]?.label ?? "…"}`,
        hot: steps[stepIdx]?.status === "running",
      },
      ...(captureTs ? [{ t: "Dernier screenshot", s: captureTs, hot: false }] : []),
      {
        t: "Mode",
        s: autoMode ? "Mode automatique" : "Mode pas-à-pas",
        hot: false,
      },
    ];

    useStageData.getState().setShellData("Browserbase · Live", items);

    return () => {
      useStageData.getState().clearShellData();
    };
  }, [sessionId, steps, currentUrl, autoMode, captureTs]);

  const handleToggleMode = useCallback(() => setAutoMode((v) => !v), []);

  // ── Render ──────────────────────────────────────────────────────────────────

  if (!sessionId) {
    return (
      <motion.section
        key={`${mode}-empty`}
        variants={CONTAINER_VARIANTS}
        initial="hidden"
        animate="visible"
        className="preserve-3d flex w-full flex-col gap-16"
      >
        <EmptyBrowserState />
      </motion.section>
    );
  }

  return (
    <motion.section
      key={`${mode}-${sessionId}`}
      variants={CONTAINER_VARIANTS}
      initial="hidden"
      animate="visible"
      className="preserve-3d flex w-full flex-col gap-16"
    >
      <StageLayout
        eyebrow="Browserbase"
        title="Session active"
        subtitle="Navigation cloud · Stagehand · Browserbase"
        actions={<ModeToggle auto={autoMode} onToggle={handleToggleMode} />}
      >
        {/* Chargement */}
        {fetchState === "loading" && <LoadingState />}

        {/* Erreur fetch */}
        {fetchState === "error" && fetchError && (
          <StageErrorBanner message={fetchError} title="Erreur session" variant="emphasis" />
        )}

        {/* Frame navigateur */}
        {(fetchState === "ready" || fetchState === "idle") && (
          <SessionFrame sessionId={sessionId} url={currentUrl} sessionInfo={sessionInfo} />
        )}

        {/* Steps Stagehand */}
        <div className="flex flex-col gap-1">
          <p className="t-11 text-(--text-ghost) mb-2 tracking-(--tracking-micro)">
            {steps.length > 0
              ? `Étapes Stagehand — ${doneCount(steps)} / ${steps.length}`
              : "Étapes Stagehand — en attente de données"}
          </p>
          {steps.length > 0 ? (
            <AnimatePresence initial={false}>
              {steps.map((step, idx) => (
                <StepRow key={step.id} step={step} index={idx} />
              ))}
            </AnimatePresence>
          ) : (
            <p className="t-13 text-(--text-ghost) py-2">
              Les étapes s&apos;afficheront ici quand la session Browserbase transmettra des
              événements.
            </p>
          )}
        </div>
      </StageLayout>
    </motion.section>
  );
}
