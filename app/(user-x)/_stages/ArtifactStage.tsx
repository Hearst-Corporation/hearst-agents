"use client";

import { motion, type Variants } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { CodeEditor } from "@/app/(user)/components/artifact/CodeEditor";
import { type ExecResult, PreviewPane } from "@/app/(user)/components/artifact/PreviewPane";
import { useStageStore } from "@/stores/stage";

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const DEFAULT_PYTHON_CODE = '# Tape ton code Python ici.\nprint("hello hearst")\n';
const DEFAULT_NODE_CODE = '// Tape ton code Node ici.\nconsole.log("hello hearst");\n';
const POLL_INTERVAL_MS = 1500;
const POLL_MAX_ATTEMPTS = 80;

// ---------------------------------------------------------------------------
// Animations Framer Motion (module-level)
// ---------------------------------------------------------------------------

const PANE_VARIANTS: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] } },
};

const BADGE_VARIANTS = {
  idle: { backgroundColor: "rgba(255,255,255,0.08)" },
  running: { backgroundColor: "rgba(0,200,160,0.18)" },
  ready: { backgroundColor: "rgba(0,200,160,0.10)" },
  failed: { backgroundColor: "rgba(220,50,50,0.18)" },
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ArtifactStageProps {
  mode: string;
}

// ---------------------------------------------------------------------------
// Composant
// ---------------------------------------------------------------------------

export function ArtifactStage({ mode: _mode }: ArtifactStageProps) {
  const rawPayload = useStageStore((s) => s.current);
  const payload =
    rawPayload.mode === "artifact"
      ? (rawPayload as {
          mode: "artifact";
          artifactId?: string;
          code?: string;
          language?: "python" | "node";
        })
      : { mode: "artifact" as const, artifactId: undefined, code: undefined, language: undefined };

  const [code, setCode] = useState<string>(payload.code ?? DEFAULT_PYTHON_CODE);
  const [language, setLanguage] = useState<"python" | "node">(payload.language ?? "python");
  const [runState, setRunState] = useState<"idle" | "running" | "ready" | "failed">("idle");
  const [result, setResult] = useState<ExecResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"preview" | "logs">("preview");

  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollAttemptsRef = useRef(0);

  // -------------------------------------------------------------------------
  // Fetch artifact si artifactId présent au mount
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!payload.artifactId) return;
    (async () => {
      try {
        const res = await fetch(`/api/v2/assets/${payload.artifactId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (typeof data.code === "string") setCode(data.code);
        if (data.language === "python" || data.language === "node") setLanguage(data.language);
        if (data.output) setResult(data.output as ExecResult);
      } catch {
        // fail soft
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload.artifactId]);

  // -------------------------------------------------------------------------
  // Polling cleanup
  // -------------------------------------------------------------------------

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);

  // -------------------------------------------------------------------------
  // Polling logique
  // -------------------------------------------------------------------------

  function schedulePoll(id: string) {
    if (pollAttemptsRef.current >= POLL_MAX_ATTEMPTS) {
      setRunState("failed");
      setErrorMessage("Timeout : l'exécution a pris trop de temps.");
      return;
    }

    pollTimerRef.current = setTimeout(async () => {
      pollAttemptsRef.current += 1;
      try {
        const res = await fetch(`/api/v2/jobs/${id}/status`);
        if (!res.ok) {
          setRunState("failed");
          setErrorMessage(`Erreur HTTP ${res.status} lors du poll.`);
          return;
        }
        const data = await res.json();

        if (data.status === "completed") {
          let execResult: ExecResult | null = null;
          if (data.storageUrl) {
            try {
              const resultRes = await fetch(data.storageUrl as string);
              execResult = (await resultRes.json()) as ExecResult;
            } catch {
              execResult = data.result ?? null;
            }
          } else {
            execResult = data.result ?? null;
          }
          setResult(execResult);
          setRunState("ready");
        } else if (data.status === "failed") {
          setRunState("failed");
          setErrorMessage(data.error ?? "Le job a échoué.");
        } else {
          schedulePoll(id);
        }
      } catch {
        setRunState("failed");
        setErrorMessage("Erreur réseau lors du poll.");
      }
    }, POLL_INTERVAL_MS);
  }

  // -------------------------------------------------------------------------
  // handleRun
  // -------------------------------------------------------------------------

  async function handleRun() {
    if (runState === "running") return;

    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    pollAttemptsRef.current = 0;

    setRunState("running");
    setResult(null);
    setErrorMessage(null);
    setJobId(null);

    try {
      const res = await fetch("/api/v2/jobs/code-exec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language }),
      });

      if (!res.ok) {
        setRunState("failed");
        setErrorMessage(`Erreur HTTP ${res.status} lors de l'envoi du job.`);
        return;
      }

      const data = await res.json();
      const id = data.jobId as string;
      setJobId(id);
      schedulePoll(id);
    } catch {
      setRunState("failed");
      setErrorMessage("Erreur réseau lors de l'envoi du job.");
    }
  }

  // -------------------------------------------------------------------------
  // Helpers UI
  // -------------------------------------------------------------------------

  const fileLabel = language === "python" ? "script.py" : "fichier.tsx";

  const badgeLabel: Record<typeof runState, string> = {
    idle: "En attente",
    running: "En cours",
    ready: "Prêt",
    failed: "Échec",
  };

  const badgeColor: Record<typeof runState, string> = {
    idle: "var(--text-faint)",
    running: "var(--accent-teal)",
    ready: "var(--accent-teal)",
    failed: "var(--danger)",
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <motion.div
      className="flex h-full w-full flex-1"
      variants={PANE_VARIANTS}
      initial="hidden"
      animate="visible"
    >
      {/* ------------------------------------------------------------------ */}
      {/* Côté gauche — éditeur                                               */}
      {/* ------------------------------------------------------------------ */}
      <div
        className="flex flex-1 flex-col"
        style={{ borderRight: "1px solid rgba(255,255,255,0.08)" }}
      >
        {/* Header gauche */}
        <div
          className="flex shrink-0 items-center justify-between"
          style={{
            padding: "var(--space-3) var(--space-4)",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {/* Tabs langue */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                if (language === "python") return;
                setLanguage("python");
                setCode(DEFAULT_PYTHON_CODE);
              }}
              className="rounded-md t-11 px-3 py-1 transition-colors"
              style={{
                color: language === "python" ? "var(--text)" : "var(--text-faint)",
                background: language === "python" ? "rgba(255,255,255,0.08)" : "transparent",
              }}
            >
              script.py
            </button>
            <button
              type="button"
              onClick={() => {
                if (language === "node") return;
                setLanguage("node");
                setCode(DEFAULT_NODE_CODE);
              }}
              className="rounded-md t-11 px-3 py-1 transition-colors"
              style={{
                color: language === "node" ? "var(--text)" : "var(--text-faint)",
                background: language === "node" ? "rgba(255,255,255,0.08)" : "transparent",
              }}
            >
              fichier.tsx
            </button>
          </div>

          {/* Badge runState */}
          <motion.span
            className="t-11 rounded-pill px-2 py-0.5"
            animate={BADGE_VARIANTS[runState]}
            style={{ color: badgeColor[runState] }}
          >
            {badgeLabel[runState]}
          </motion.span>
        </div>

        {/* Éditeur */}
        <div className="flex min-h-0 flex-1 flex-col" style={{ padding: "var(--space-3)" }}>
          <CodeEditor
            value={code}
            onChange={setCode}
            language={language}
            onRun={handleRun}
            disabled={runState === "running"}
          />
        </div>

        {/* Bouton Exécuter */}
        <div
          className="flex shrink-0 justify-end"
          style={{
            padding: "var(--space-3) var(--space-4)",
            borderTop: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <button
            type="button"
            className="vision-btn-primary rounded-pill px-6 py-2.5 text-sm transition-opacity disabled:opacity-40"
            onClick={handleRun}
            disabled={runState === "running"}
          >
            {runState === "running" ? "En cours…" : "Exécuter"}
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Côté droit — preview                                                */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-1 flex-col">
        {/* Header droit */}
        <div
          className="flex shrink-0 items-center gap-1"
          style={{
            padding: "var(--space-3) var(--space-4)",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab("preview")}
            className="rounded-md t-11 px-3 py-1 transition-colors"
            style={{
              color: activeTab === "preview" ? "var(--text)" : "var(--text-faint)",
              background: activeTab === "preview" ? "rgba(255,255,255,0.08)" : "transparent",
            }}
          >
            Preview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("logs")}
            className="rounded-md t-11 px-3 py-1 transition-colors"
            style={{
              color: activeTab === "logs" ? "var(--text)" : "var(--text-faint)",
              background: activeTab === "logs" ? "rgba(255,255,255,0.08)" : "transparent",
            }}
          >
            Logs
          </button>

          {/* jobId discret pour debug */}
          {jobId && (
            <span className="ml-auto t-11" style={{ color: "var(--text-faint)" }}>
              {jobId.slice(0, 8)}&hellip;
            </span>
          )}
        </div>

        {/* PreviewPane / Logs */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {activeTab === "preview" ? (
            <PreviewPane state={runState} result={result} errorMessage={errorMessage} />
          ) : (
            <div className="flex-1 overflow-y-auto" style={{ padding: "var(--space-4)" }}>
              {result?.stdout ? (
                <pre
                  className="t-11 font-mono whitespace-pre-wrap"
                  style={{ color: "var(--text-muted)" }}
                >
                  {result.stdout}
                </pre>
              ) : result?.stderr ? (
                <pre
                  className="t-11 font-mono whitespace-pre-wrap"
                  style={{ color: "var(--warn)" }}
                >
                  {result.stderr}
                </pre>
              ) : (
                <p className="t-13 font-light" style={{ color: "var(--text-faint)" }}>
                  Aucun log disponible.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Supprime l'avertissement ESLint sur fileLabel inutilisé */}
      <span className="sr-only" aria-hidden>
        {fileLabel}
      </span>
    </motion.div>
  );
}
