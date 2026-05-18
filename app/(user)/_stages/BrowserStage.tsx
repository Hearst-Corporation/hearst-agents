"use client";

/**
 * BrowserStage — consumer data-bound session Browserbase + Stagehand.
 *
 * Lit le `sessionId` depuis `useStageStore` (payload mode="browser") et
 * fetche l'état de session via GET /api/v2/browser/[id].
 *
 * Mock robuste : les steps Stagehand sont simulés localement avec
 * possibilité de branchement vers un vrai endpoint futur (voir TODO).
 *
 * Push vers ContextRail : URL courante + étape X/Y + timestamp + mode.
 */

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { EmptyState } from "@/app/(user)/components/ui";
import { sanitizeApiError } from "@/app/(user)/lib/sanitize-error";
import { useStageStore } from "@/stores/stage";
import { useStageData } from "@/stores/stage-data";
import { STAGE_REGISTRY } from "./registry";
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

// Étapes Stagehand — alimentées par SSE futur (/api/v2/browser/[id]/steps).
// En attendant, le tableau reste vide ; l'UI affiche un état "en attente".

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

function stepDotColor(status: StepStatus): string {
  switch (status) {
    case "done":
      return "rgba(94,229,195,0.85)";
    case "running":
      return "rgba(140,100,255,0.9)";
    case "error":
      return "rgba(255,80,80,0.85)";
    case "pending":
    default:
      return "rgba(255,255,255,0.2)";
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
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: VISION_EASE }}
      className="flex items-center gap-2.5 py-10 text-(--text-ghost) t-13"
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

function ErrorState({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: VISION_EASE }}
      className="px-[18px] py-3.5 rounded-xl bg-(--danger)/8 border-l-2 border-(--danger)/55 text-(--danger)/85 t-13 leading-[1.55]"
    >
      <strong className="text-(--danger)/95 font-semibold">Erreur session</strong> — {message}
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
      <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-(--line-strong) bg-(--bg-soft)">
        {/* Traffic lights */}
        <div className="flex gap-1.5">
          {(
            ["rgba(255,90,90,0.45)", "rgba(255,188,58,0.45)", "rgba(94,229,195,0.45)"] as const
          ).map((bg, i) => (
            <span key={i} className="size-2.5 rounded-full" style={{ background: bg }} />
          ))}
        </div>

        {/* URL pill */}
        <div className="flex-1 px-3 py-1.5 rounded-lg bg-(--surface-2) t-13 text-(--text-faint) font-mono truncate">
          🔒 {url || `session:${sessionId.slice(0, 8)}…`}
        </div>

        {/* Indicateur live */}
        <div className="flex items-center gap-1.5">
          <motion.div
            className="size-[5px] rounded-full"
            style={{
              background: isActive ? "rgba(140,100,255,0.9)" : "rgba(255,255,255,0.2)",
            }}
            animate={isActive ? { opacity: [1, 0.3, 1] } : { opacity: 1 }}
            transition={isActive ? { repeat: Infinity, duration: 1, ease: "easeInOut" } : {}}
          />
          <span className="t-10 text-(--accent-llm)/85">
            {isActive ? "Session active" : "Inactif"}
          </span>
        </div>
      </div>

      {/* Viewport — placeholder aspect-video, PAS d'iframe (XSS / cross-origin) */}
      <div className="aspect-video bg-black/20 flex flex-col items-center justify-center gap-2.5">
        {isActive ? (
          <>
            <motion.div
              className="size-2 rounded-full bg-(--accent-llm)/75"
              animate={{ opacity: [1, 0.25, 1], scale: [1, 1.3, 1] }}
              transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
            />
            <span className="t-13 text-(--text-ghost)">Session Browserbase active</span>
            <span className="t-11 text-(--text-decor-25) font-mono">{sessionId.slice(0, 16)}…</span>
          </>
        ) : (
          <span className="t-13 text-(--text-decor-25)">Session inactive</span>
        )}
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
      className="flex items-center gap-3 px-3.5 py-2.5 rounded-[10px] transition-[opacity,background] duration-300 ease-[ease]"
      style={{
        background: isRunning ? "rgba(140,100,255,0.06)" : "transparent",
        border: isRunning ? "1px solid rgba(140,100,255,0.15)" : "1px solid rgba(255,255,255,0.04)",
        opacity: isPending ? 0.4 : 1,
      }}
    >
      {/* Numéro / check */}
      <div
        className="size-6 rounded-full flex items-center justify-center t-11 font-semibold shrink-0"
        style={{
          background: stepDotColor(step.status),
          color: isDone || isRunning || isError ? "rgba(0,0,0,0.85)" : "rgba(255,255,255,0.3)",
        }}
      >
        {isDone ? "✓" : isError ? "✕" : isRunning ? "…" : index + 1}
      </div>

      {/* Label */}
      <div className="flex-1 t-13 text-(--text-soft) leading-[1.45]">{step.label}</div>

      {/* Badge état — ternaires imbriquées 4 niveaux, bloc préservé inline */}
      <div
        style={{
          padding: "3px 9px",
          borderRadius: "9999px",
          fontSize: "11px",
          fontWeight: 500,
          background: isError
            ? "rgba(255,80,80,0.12)"
            : isRunning
              ? "rgba(140,100,255,0.15)"
              : isDone
                ? "rgba(255,255,255,0.05)"
                : "transparent",
          color: isError
            ? "rgba(255,140,140,0.9)"
            : isRunning
              ? "rgba(140,100,255,0.9)"
              : isDone
                ? "rgba(255,255,255,0.35)"
                : "rgba(255,255,255,0.2)",
        }}
      >
        {stepStateLabel(step.status)}
      </div>
    </motion.div>
  );
}

function ModeToggle({ auto, onToggle }: { auto: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="t-13 text-(--text-ghost)">
        {auto ? "Mode automatique" : "Mode pas-à-pas"}
      </span>
      <button
        type="button"
        onClick={onToggle}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-(--line) t-13 font-medium cursor-pointer transition-colors focus-visible:ring-1 focus-visible:ring-(--accent-llm)/50 focus-visible:outline-none ${
          auto ? "bg-(--accent-llm)/12 text-(--accent-llm)" : "bg-white/5 text-(--text-faint)"
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
  // de session active). Falsy → état idle / empty state existant.
  const realSessionId = payload.mode === "browser" && payload.sessionId ? payload.sessionId : null;
  const sessionId = realSessionId;

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
          new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
        );
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === "AbortError") return;
        setFetchError(sanitizeApiError(err));
        setFetchState("error");
      });

    return () => ctrl.abort();
  }, [sessionId]);

  // Polling des steps Stagehand — déclenché uniquement sur une vraie session.
  // S'arrête si la session passe dans un état terminal.
  // TODO: dépend SSE backend — la route /api/v2/browser/sessions/[id]/steps
  //   n'existe pas encore. Le squelette est prêt ; remplacer le no-op par le
  //   vrai fetch dès que le backend l'expose.
  useEffect(() => {
    if (!realSessionId) return;

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

    const poll = async () => {
      // Guard terminal : si la session est déjà dans un état final, on s'arrête.
      if (sessionInfo && TERMINAL_STATUSES.has(sessionInfo.status)) {
        controller.abort();
        return;
      }

      try {
        // TODO: dépend SSE backend — no-op si 404 (route non encore créée).
        const res = await fetch(`/api/v2/browser/sessions/${realSessionId}/steps`, {
          signal: controller.signal,
          credentials: "include",
        });
        if (!res.ok) return; // 404 ou autre → on ignore silencieusement
        // TODO: brancher setSteps() quand /api/v2/browser/sessions/[id]/steps est dispo.
        await res.json();
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        // Erreur réseau silencieuse — on laisse le polling continuer
      }
    };

    const interval = setInterval(poll, 5000);
    void poll(); // appel immédiat

    return () => {
      clearInterval(interval);
      controller.abort();
    };
  }, [realSessionId, sessionInfo]);

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
      {/* Header */}
      <header className="flex flex-col gap-2">
        <p className="t-13 text-(--text-decor-25) tracking-[.04em]">
          Browserbase · Stagehand · navigateur cloud
        </p>
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="t-28 font-medium tracking-[-.02em]">Session active</h1>
            {STAGE_REGISTRY.browser.tagline && (
              <p className="t-13 text-(--text-ghost) leading-[1.5]">
                {STAGE_REGISTRY.browser.tagline}
              </p>
            )}
          </div>
          <ModeToggle auto={autoMode} onToggle={handleToggleMode} />
        </div>
      </header>

      {/* Chargement */}
      {fetchState === "loading" && <LoadingState />}

      {/* Erreur fetch */}
      {fetchState === "error" && fetchError && <ErrorState message={fetchError} />}

      {/* Frame navigateur */}
      {(fetchState === "ready" || fetchState === "idle") && (
        <SessionFrame sessionId={sessionId} url={currentUrl} sessionInfo={sessionInfo} />
      )}

      {/* Steps Stagehand */}
      <div className="flex flex-col gap-1">
        <p className="t-11 text-(--text-decor-25) mb-2 tracking-[.04em]">
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
          <p className="t-13 text-(--text-decor-25) py-2">
            Les étapes s&apos;afficheront ici quand la session Browserbase transmettra des
            événements.
          </p>
        )}
      </div>
    </motion.section>
  );
}
