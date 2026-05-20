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
import { EmptyState, StageErrorBanner } from "@/app/(user)/components/ui";
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

// ── Mode démo (dev only) ─────────────────────────────────────────────────────
// Affiché uniquement en dev quand aucune session réelle n'est branchée, pour
// pouvoir développer le design sans backend. Inchangé en production.

const IS_DEV = process.env.NODE_ENV !== "production";

const DEMO_SESSION_ID = "bb_demo_session_3f8a1c9e2d4b";

const DEMO_SESSION: SessionInfo = {
  status: "running",
  createdAt: new Date().toISOString(),
  stoppedAt: null,
  debugViewerUrl: "https://www.browserbase.com/sessions/bb_demo_session_3f8a1c9e2d4b/debug",
  connectUrl: "https://www.linkedin.com/in/contact-prioritaire",
};

const DEMO_STEPS: BrowserStep[] = [
  { id: "demo-1", label: "Ouverture de la page LinkedIn du prospect", status: "done" },
  { id: "demo-2", label: "Acceptation de la bannière cookies", status: "done" },
  { id: "demo-3", label: "Extraction du poste et de l'entreprise", status: "done" },
  { id: "demo-4", label: "Navigation vers la page Contact", status: "running" },
  { id: "demo-5", label: "Récupération de l'adresse e-mail professionnelle", status: "pending" },
  { id: "demo-6", label: "Synthèse de la fiche prospect", status: "pending" },
];

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
      return "bg-text-ghost/30";
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

function DemoBanner() {
  return (
    <div className="t-9 self-start font-mono uppercase tracking-wide text-(--text-faint) bg-(--surface-1) py-(--space-1) px-(--space-3) rounded-full">
      Démo · données fictives (dev)
    </div>
  );
}

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
      className="flex items-center gap-(--space-2-5) py-10 text-(--text-ghost) t-13"
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
      <div className="aspect-video bg-(--surface-1) flex flex-col items-center justify-center gap-(--space-2-5)">
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
      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg border transition-[opacity,background,border-color] duration-300 ease-[ease] ${
        isRunning
          ? "bg-(--accent-llm)/6 border-(--accent-llm)/15"
          : "border-(--line) bg-transparent"
      } ${isPending ? "opacity-40" : ""}`}
    >
      <div
        className={`size-6 rounded-full flex items-center justify-center t-11 font-semibold shrink-0 ${stepDotClass(step.status)} ${
          isDone || isRunning || isError ? "text-text-on-accent-teal" : "text-text-ghost"
        }`}
      >
        {isDone ? "✓" : isError ? "✕" : isRunning ? "…" : index + 1}
      </div>

      <div className="flex-1 t-13 text-(--text-soft) leading-(--leading-base)">{step.label}</div>

      <span
        className={`t-11 font-medium px-2 py-0.5 rounded-pill shrink-0 ${
          isError
            ? "bg-(--danger)/10 text-(--danger)"
            : isRunning
              ? "bg-(--accent-llm)/15 text-(--accent-llm)"
              : isDone
                ? "bg-(--surface-1) text-text-muted"
                : "text-text-ghost"
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
      <span className="t-13 text-(--text-ghost)">
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
  // de session active). Sans ça, `realSessionId ?? demo` garderait "" (le ??
  // ne traite pas la chaîne vide comme nullish) et la démo ne s'activerait pas.
  const realSessionId = payload.mode === "browser" && payload.sessionId ? payload.sessionId : null;

  // Mode démo : actif uniquement en dev ET sans session réelle. Le fetch réel
  // reste prioritaire — dès qu'une vraie session arrive, la démo disparaît.
  const demoActive = IS_DEV && !realSessionId;
  const sessionId = realSessionId ?? (demoActive ? DEMO_SESSION_ID : null);

  const [fetchState, setFetchState] = useState<FetchState>("idle");
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const steps: BrowserStep[] = demoActive ? DEMO_STEPS : EMPTY_STEPS;
  const [currentUrl, setCurrentUrl] = useState<string>("");
  const [autoMode, setAutoMode] = useState(true);
  const [captureTs, setCaptureTs] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Fetch session info quand sessionId dispo
  useEffect(() => {
    if (demoActive) {
      // Pas d'appel réseau : on injecte la session démo telle quelle.
      setSessionInfo(DEMO_SESSION);
      setCurrentUrl(DEMO_SESSION.connectUrl ?? DEMO_SESSION.debugViewerUrl ?? "");
      setFetchState("ready");
      setCaptureTs(new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }));
      setFetchError(null);
      return;
    }

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
  }, [sessionId, demoActive]);

  // Polling des steps Stagehand — déclenché uniquement sur une vraie session
  // (demoActive === false). S'arrête si la session passe dans un état terminal.
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
      {demoActive && <DemoBanner />}

      {/* Header */}
      <header className="flex flex-col gap-2">
        <p className="t-13 text-(--text-decor-25) tracking-(--tracking-micro)">
          Browserbase · Stagehand · navigateur cloud
        </p>
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="t-28 font-medium tracking-(--tracking-tight)">Session active</h1>
            {STAGE_REGISTRY.browser.tagline && (
              <p className="t-13 text-(--text-ghost) leading-(--leading-normal)">
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
      {fetchState === "error" && fetchError && (
        <StageErrorBanner message={fetchError} title="Erreur session" variant="emphasis" />
      )}

      {/* Frame navigateur */}
      {(fetchState === "ready" || fetchState === "idle") && (
        <SessionFrame sessionId={sessionId} url={currentUrl} sessionInfo={sessionInfo} />
      )}

      {/* Steps Stagehand */}
      <div className="flex flex-col gap-1">
        <p className="t-11 text-(--text-decor-25) mb-2 tracking-(--tracking-micro)">
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
