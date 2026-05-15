"use client";

/**
 * PreviewPane — Pane droite d'ArtifactStage (B8).
 *
 * Rend l'output d'une exécution E2B selon son type :
 *   - stdout text  → <pre> mono
 *   - stderr       → block warn
 *   - HTML         → iframe sandboxed (allow-scripts uniquement, jamais
 *                    allow-same-origin pour des HTML user-générés)
 *   - image base64 → `next/image` (data URL, `unoptimized`)
 *   - JSON         → <pre> mono (chart spec rendering = phase 2)
 *
 * Empty/loading/error états gérés inline. Pas de dépendance externe.
 */

import Image from "next/image";
import { useMemo } from "react";

export type ExecResultItem = {
  type: string;
  data: unknown;
};

export interface ExecResult {
  stdout: string;
  stderr: string;
  results: ExecResultItem[];
  error?: string | null;
}

interface PreviewPaneProps {
  state: "idle" | "running" | "ready" | "failed";
  result?: ExecResult | null;
  errorMessage?: string | null;
  /** Progress (0-100) lors d'un run. */
  progress?: number;
}

export function PreviewPane({ state, result, errorMessage, progress }: PreviewPaneProps) {
  const htmlResult = useMemo(() => {
    if (!result) return null;
    return result.results.find(
      (r) =>
        r.type === "text" &&
        typeof r.data === "string" &&
        /^<!?\w/i.test((r.data as string).trim()),
    ) as ExecResultItem | undefined;
  }, [result]);

  const imageResult = useMemo(() => {
    if (!result) return null;
    return result.results.find((r) => r.type === "image/png" || r.type === "image/jpeg") as
      | ExecResultItem
      | undefined;
  }, [result]);

  const jsonResult = useMemo(() => {
    if (!result) return null;
    return result.results.find((r) => r.type === "json") as ExecResultItem | undefined;
  }, [result]);

  if (state === "idle") {
    return (
      <div
        className="flex h-full flex-1 flex-col items-center justify-center text-center"
        style={{ padding: "var(--space-8)" }}
      >
        <p className="t-13 font-light text-text-faint">
          La sortie d&apos;exécution apparaîtra ici.
        </p>
        <p className="t-11 mt-2 font-light text-text-faint">⌘Enter pour lancer</p>
      </div>
    );
  }

  if (state === "running") {
    return (
      <div
        className="flex h-full flex-1 flex-col items-center justify-center gap-4"
        style={{ padding: "var(--space-8)" }}
      >
        <span
          className="rounded-pill bg-(--accent-teal)"
          style={{
            width: "var(--space-3)",
            height: "var(--space-3)",
            animation: "pulse 1.2s ease-in-out infinite",
          }}
          aria-hidden
        />
        <p className="t-11 font-medium text-(--accent-teal)">
          E2B · EXÉCUTION{progress != null ? ` · ${Math.round(progress)}%` : ""}
        </p>
      </div>
    );
  }

  if (state === "failed") {
    return (
      <div className="flex h-full flex-1 flex-col gap-3" style={{ padding: "var(--space-6)" }}>
        <span className="t-11 font-medium text-(--danger)">ÉCHEC</span>
        <pre
          className="t-11 font-mono whitespace-pre-wrap text-(--danger)"
          style={{
            padding: "var(--space-3)",
            background: "var(--surface-1)",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border-default)",
          }}
        >
          {errorMessage ?? "Erreur inconnue"}
        </pre>
      </div>
    );
  }

  if (!result) return null;

  return (
    <div
      className="flex h-full flex-1 flex-col gap-4 overflow-y-auto"
      style={{ padding: "var(--space-6)" }}
    >
      {result.error && (
        <section className="flex flex-col gap-2">
          <span className="t-11 font-medium text-(--danger)">ERROR</span>
          <pre
            className="t-11 font-mono whitespace-pre-wrap text-(--danger)"
            style={{
              padding: "var(--space-3)",
              background: "var(--surface-1)",
              borderRadius: "var(--radius-sm)",
            }}
          >
            {result.error}
          </pre>
        </section>
      )}

      {imageResult && (
        <section className="flex flex-col gap-2">
          <span className="t-11 font-medium text-(--accent-teal)">IMAGE</span>
          <Image
            unoptimized
            src={`data:${imageResult.type};base64,${imageResult.data as string}`}
            alt="Sortie image E2B"
            width={1600}
            height={1200}
            className="max-w-full h-auto rounded-md border border-(--border-default)"
          />
        </section>
      )}

      {htmlResult && (
        <section className="flex flex-col gap-2">
          <span className="t-11 font-medium text-(--accent-teal)">HTML</span>
          <iframe
            sandbox="allow-scripts"
            srcDoc={htmlResult.data as string}
            title="Sortie HTML E2B"
            className="rounded-md border border-(--border-default) bg-surface-1"
            style={{ width: "100%", minHeight: "var(--space-32)" }}
          />
        </section>
      )}

      {jsonResult && (
        <section className="flex flex-col gap-2">
          <span className="t-11 font-light text-text-faint">JSON</span>
          <pre
            className="t-11 font-mono whitespace-pre-wrap text-text-muted"
            style={{
              padding: "var(--space-3)",
              background: "var(--surface-1)",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border-default)",
            }}
          >
            {JSON.stringify(jsonResult.data, null, 2)}
          </pre>
        </section>
      )}

      {result.stdout && (
        <section className="flex flex-col gap-2">
          <span className="t-11 font-light text-text-faint">STDOUT</span>
          <pre
            className="t-11 font-mono whitespace-pre-wrap text-text"
            style={{
              padding: "var(--space-3)",
              background: "var(--surface-1)",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border-default)",
            }}
          >
            {result.stdout}
          </pre>
        </section>
      )}

      {result.stderr && (
        <section className="flex flex-col gap-2">
          <span className="t-11 font-medium text-(--warn)">STDERR</span>
          <pre
            className="t-11 font-mono whitespace-pre-wrap text-(--warn)"
            style={{
              padding: "var(--space-3)",
              background: "var(--surface-1)",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border-default)",
            }}
          >
            {result.stderr}
          </pre>
        </section>
      )}

      {!result.stdout && !result.stderr && !result.error && result.results.length === 0 && (
        <p className="t-13 font-light text-text-faint">Exécution terminée sans sortie.</p>
      )}
    </div>
  );
}
