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
import { useStageStore } from "@/stores/stage";
import { useStageData } from "@/stores/stage-data";
import type { RailItem } from "./types";

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

const VISION_EASE = [0.22, 1, 0.36, 1] as const;

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
        gap: "12px",
      }}
    >
      <p
        className="t-15"
        style={{ color: "rgba(255,255,255,0.45)", maxWidth: "440px", lineHeight: 1.6 }}
      >
        Aucune session active. Lance une mission de navigation ou demande à l'agent.
      </p>
    </motion.div>
  );
}

function LoadingState() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: VISION_EASE }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "40px 0",
        color: "rgba(255,255,255,0.4)",
        fontSize: "13px",
      }}
    >
      <motion.div
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          background: "rgba(140,100,255,0.9)",
        }}
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
      <strong style={{ color: "rgba(255,180,180,0.95)", fontWeight: 600 }}>Erreur session</strong> —{" "}
      {message}
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
    <div
      style={{
        borderRadius: "14px",
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.07)",
        background: "rgba(255,255,255,0.02)",
      }}
    >
      {/* Barre navigateur */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "10px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(255,255,255,0.03)",
        }}
      >
        {/* Traffic lights */}
        <div style={{ display: "flex", gap: "6px" }}>
          {(
            ["rgba(255,90,90,0.45)", "rgba(255,188,58,0.45)", "rgba(94,229,195,0.45)"] as const
          ).map((bg, i) => (
            <span
              key={i}
              style={{ width: "10px", height: "10px", borderRadius: "50%", background: bg }}
            />
          ))}
        </div>

        {/* URL pill */}
        <div
          style={{
            flex: 1,
            padding: "5px 12px",
            borderRadius: "8px",
            background: "rgba(255,255,255,0.05)",
            fontSize: "12px",
            color: "rgba(255,255,255,0.45)",
            fontFamily: "monospace",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          🔒 {url || `session:${sessionId.slice(0, 8)}…`}
        </div>

        {/* Indicateur live */}
        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <motion.div
            style={{
              width: "5px",
              height: "5px",
              borderRadius: "50%",
              background: isActive ? "rgba(140,100,255,0.9)" : "rgba(255,255,255,0.2)",
            }}
            animate={isActive ? { opacity: [1, 0.3, 1] } : { opacity: 1 }}
            transition={isActive ? { repeat: Infinity, duration: 1, ease: "easeInOut" } : {}}
          />
          <span style={{ fontSize: "10px", color: "rgba(140,100,255,0.85)" }}>
            {isActive ? "Session active" : "Inactif"}
          </span>
        </div>
      </div>

      {/* Viewport — placeholder aspect-video, PAS d'iframe (XSS / cross-origin) */}
      <div
        style={{
          aspectRatio: "16 / 9",
          background: "rgba(0,0,0,0.2)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "10px",
        }}
      >
        {isActive ? (
          <>
            <motion.div
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: "rgba(140,100,255,0.75)",
              }}
              animate={{ opacity: [1, 0.25, 1], scale: [1, 1.3, 1] }}
              transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
            />
            <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.35)" }}>
              Session Browserbase active
            </span>
            <span
              style={{
                fontSize: "11px",
                color: "rgba(255,255,255,0.2)",
                fontFamily: "monospace",
              }}
            >
              {sessionId.slice(0, 16)}…
            </span>
          </>
        ) : (
          <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.25)" }}>
            Session inactive
          </span>
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
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "10px 14px",
        borderRadius: "10px",
        background: isRunning ? "rgba(140,100,255,0.06)" : "transparent",
        border: isRunning ? "1px solid rgba(140,100,255,0.15)" : "1px solid rgba(255,255,255,0.04)",
        opacity: isPending ? 0.4 : 1,
        transition: "opacity 0.3s ease, background 0.3s ease",
      }}
    >
      {/* Numéro / check */}
      <div
        style={{
          width: "24px",
          height: "24px",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: stepDotColor(step.status),
          color: isDone || isRunning || isError ? "rgba(0,0,0,0.85)" : "rgba(255,255,255,0.3)",
          fontSize: "11px",
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        {isDone ? "✓" : isError ? "✕" : isRunning ? "…" : index + 1}
      </div>

      {/* Label */}
      <div style={{ flex: 1, fontSize: "13px", color: "rgba(255,255,255,0.8)", lineHeight: 1.45 }}>
        {step.label}
      </div>

      {/* Badge état */}
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
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)" }}>
        {auto ? "Mode automatique" : "Mode pas-à-pas"}
      </span>
      <button
        type="button"
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "5px 12px",
          borderRadius: "8px",
          border: "1px solid rgba(255,255,255,0.1)",
          background: auto ? "rgba(140,100,255,0.12)" : "rgba(255,255,255,0.05)",
          color: auto ? "rgba(140,100,255,0.9)" : "rgba(255,255,255,0.45)",
          fontSize: "12px",
          fontWeight: 500,
          cursor: "pointer",
          transition: "background 0.2s ease, color 0.2s ease",
        }}
      >
        {auto ? "Auto" : "Pas-à-pas"}
      </button>
    </div>
  );
}

// ── Composant principal ──────────────────────────────────────────────────────

export function BrowserStage({ mode }: { mode: string }) {
  const payload = useStageStore((s) => s.current);
  const sessionId = payload.mode === "browser" ? payload.sessionId : null;

  const [fetchState, setFetchState] = useState<FetchState>("idle");
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [steps] = useState<BrowserStep[]>([]);
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
        setFetchError(err instanceof Error ? err.message : String(err));
        setFetchState("error");
      });

    return () => ctrl.abort();
  }, [sessionId]);

  // Steps : en attente de SSE /api/v2/browser/[id]/steps.

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
      <header style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <p
          style={{
            fontSize: "12px",
            color: "rgba(255,255,255,0.3)",
            letterSpacing: ".04em",
          }}
        >
          Browserbase · Stagehand · navigateur cloud
        </p>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h1 style={{ fontSize: "28px", fontWeight: 500, letterSpacing: "-.02em" }}>
            Session active
          </h1>
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
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <p
          style={{
            fontSize: "11px",
            color: "rgba(255,255,255,0.3)",
            marginBottom: "8px",
            letterSpacing: ".04em",
          }}
        >
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
          <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.25)", padding: "8px 0" }}>
            Les étapes s&apos;afficheront ici quand la session Browserbase transmettra des
            événements.
          </p>
        )}
      </div>
    </motion.section>
  );
}
