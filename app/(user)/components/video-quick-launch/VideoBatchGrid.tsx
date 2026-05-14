"use client";

/**
 * VideoBatchGrid — résultats batch (Q3-A) du VideoQuickLaunch.
 *
 * Grille N cards (1, 2, ou 4 colonnes selon le nombre de variants), chaque
 * card affiche un placeholder thumbnail, une progress bar dédiée, et le
 * label phase. Stagger 100 ms à l'entrée (transition CSS standard).
 */

import { useEffect, useMemo, useState } from "react";
import { progressLabel, type BatchVariantRun } from "./types";

export function VideoBatchGrid({
  runs,
  batchError,
}: {
  runs: BatchVariantRun[];
  batchError: string | null;
}) {
  // Stagger 100ms entre les cards (transition-delay).
  const count = runs.length;
  const cols = count >= 4 ? 2 : count === 1 ? 1 : 2;

  return (
    <>
      {batchError && (
        <div
          style={{
            padding: "var(--space-3) var(--space-4)",
            borderLeft: "2px solid var(--danger)",
            background: "var(--card-flat-bg)",
          }}
        >
          <p className="t-11 font-medium text-(--danger)">{batchError}</p>
        </div>
      )}
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gap: "var(--space-4)",
        }}
        data-testid="batch-run-grid"
      >
        {runs.map((run, i) => (
          <BatchRunCard key={run.localId} run={run} delayMs={i * 100} />
        ))}
      </div>
    </>
  );
}

function BatchRunCard({
  run,
  delayMs,
}: {
  run: BatchVariantRun;
  delayMs: number;
}) {
  // Stagger entrée : on démarre invisible/translaté puis on bascule via
  // useEffect pour déclencher la transition CSS standard. Évite de
  // dépendre d'une keyframe globale.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), delayMs);
    return () => clearTimeout(t);
  }, [delayMs]);

  const label = useMemo(() => {
    if (run.phase === "queued") return "Mise en file…";
    if (run.phase === "running")
      return progressLabel(run.progress, run.form.provider);
    if (run.phase === "done") return "Vidéo prête";
    if (run.phase === "error") return run.errorMsg ?? "Échec";
    return "";
  }, [run.phase, run.progress, run.form.provider, run.errorMsg]);

  const isError = run.phase === "error";
  const isDone = run.phase === "done";
  const isPending = run.phase === "queued" || run.phase === "running";
  const displayProgress = isError
    ? 0
    : isDone
      ? 100
      : Math.max(run.progress, run.phase === "running" ? 4 : 0);

  return (
    <div
      data-testid={`batch-run-card-${run.index}`}
      className="flex flex-col"
      style={{
        padding: "var(--space-4)",
        background: "var(--surface-1)",
        border: "1px solid var(--border-shell)",
        borderRadius: "var(--radius-sm)",
        gap: "var(--space-3)",
        opacity: mounted ? 1 : 0,
        transform: mounted ? "translateY(0)" : "translateY(8px)",
        transition:
          "opacity var(--duration-emphasis) var(--ease-out-soft), transform var(--duration-emphasis) var(--ease-out-soft)",
        minWidth: 0,
      }}
    >
      <div className="flex items-center justify-between">
        <span className="t-11 font-medium text-(--accent-teal)">
          Variant {run.index + 1}
        </span>
        <span
          className={`t-11 font-mono tabular-nums ${isError ? "text-(--danger)" : isDone ? "text-(--money)" : "text-text-muted"}`}
        >
          {isError ? "Échec" : isDone ? "Prêt" : `${Math.round(run.progress)}%`}
        </span>
      </div>

      {/* Thumbnail placeholder — différencié par phase */}
      <div
        aria-hidden
        className={isPending ? "animate-pulse" : undefined}
        style={{
          aspectRatio: run.form.ratio === "720:1280" ? "9/16" : "16/9",
          background: isDone
            ? "var(--accent-teal-surface)"
            : isError
              ? "var(--card-flat-bg)"
              : "var(--bg-elev)",
          border: `1px solid ${
            isDone
              ? "var(--accent-teal)"
              : isError
                ? "var(--danger)"
                : "var(--surface-2)"
          }`,
          borderRadius: "var(--radius-xs)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {isDone && (
          <span
            aria-hidden
            className="text-(--accent-teal) font-light leading-none"
            style={{ fontSize: "2rem" }}
          >
            ✓
          </span>
        )}
        {isError && (
          <span
            aria-hidden
            className="text-(--danger) font-light leading-none"
            style={{ fontSize: "2rem" }}
          >
            ×
          </span>
        )}
      </div>

      <p
        className="t-11 font-light text-text-muted leading-relaxed"
        style={{
          maxHeight: "var(--space-12)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
        }}
        title={run.form.prompt}
      >
        {run.form.prompt}
      </p>

      <div
        aria-hidden
        style={{
          height: "var(--space-1)",
          background: "var(--bg-elev)",
          borderRadius: "var(--radius-pill)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${displayProgress}%`,
            background: isError
              ? "var(--danger)"
              : isDone
                ? "var(--money)"
                : "var(--accent-teal)",
            transition: "width var(--duration-emphasis) var(--ease-out-soft)",
          }}
        />
      </div>

      <span
        className={`t-11 font-light ${isError ? "text-(--danger)" : "text-text-muted"}`}
      >
        {label}
      </span>
    </div>
  );
}
