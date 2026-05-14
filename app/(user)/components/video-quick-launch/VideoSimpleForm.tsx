"use client";

/**
 * VideoSimpleForm — mode simple (S2-A) du VideoQuickLaunch.
 *
 * Affiche le textarea de prompt + segments Durée/Provider/Ratio + le bloc
 * progress quand `phase !== "idle"`. Tout l'état (et donc la submission)
 * vit dans le composant parent — ce form est purement présentation.
 */

import type { RefObject } from "react";
import { ProgressBlock, SegmentedRow } from "./segments";
import {
  DURATION_LABELS,
  RATIO_LABELS,
  type DurationOption,
  type Provider,
  type RatioOption,
  type SinglePhase,
} from "./types";

export function VideoSimpleForm({
  prompt,
  setPrompt,
  provider,
  setProvider,
  duration,
  setDuration,
  ratio,
  setRatio,
  phase,
  progress,
  phaseLabel,
  errorMsg,
  isBusy,
  textareaRef,
}: {
  prompt: string;
  setPrompt: (v: string) => void;
  provider: Provider;
  setProvider: (v: Provider) => void;
  duration: DurationOption;
  setDuration: (v: DurationOption) => void;
  ratio: RatioOption;
  setRatio: (v: RatioOption) => void;
  phase: SinglePhase;
  progress: number;
  phaseLabel: string;
  errorMsg: string | null;
  isBusy: boolean;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}) {
  const isDone = phase === "done";
  return (
    <>
      {/* Prompt */}
      <label className="flex flex-col" style={{ gap: "var(--space-2)" }}>
        <span className="t-11 font-medium text-text-muted">Prompt</span>
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={isBusy || isDone}
          placeholder="Une caméra qui glisse au-dessus d'une ville futuriste au crépuscule…"
          rows={4}
          className="t-13 font-light text-text bg-[var(--card-flat-bg)] border border-(--border-shell) hover:border-[var(--accent-teal-border-hover)] focus:border-[var(--accent-teal-border-hover)] focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed resize-none"
          style={{
            padding: "var(--space-3)",
            borderRadius: "var(--radius-sm)",
          }}
        />
      </label>

      {/* Durée */}
      <div role="group" aria-label="Durée">
        <SegmentedRow<DurationOption>
          label="Durée"
          options={[5, 10]}
          getLabel={(d) => DURATION_LABELS[d]}
          value={duration}
          onChange={setDuration}
          disabled={isBusy || isDone}
        />
      </div>

      {/* Provider */}
      <div role="group" aria-label="Provider">
        <SegmentedRow<Provider>
          label="Provider"
          options={["runway", "heygen"]}
          getLabel={(p) => (p === "runway" ? "Runway" : "HeyGen")}
          value={provider}
          onChange={setProvider}
          disabled={isBusy || isDone}
        />
      </div>

      {/* Ratio (Runway uniquement) */}
      {provider === "runway" && (
        <div role="group" aria-label="Format">
          <SegmentedRow<RatioOption>
            label="Format"
            options={["1280:720", "720:1280"]}
            getLabel={(r) => RATIO_LABELS[r]}
            value={ratio}
            onChange={setRatio}
            disabled={isBusy || isDone}
          />
        </div>
      )}

      {/* Progress bar */}
      {phase !== "idle" && (
        <div aria-live="polite" aria-atomic="false">
          <ProgressBlock
            phase={
              phase === "done"
                ? "done"
                : phase === "error"
                  ? "error"
                  : phase === "running"
                    ? "running"
                    : "queued"
            }
            progress={progress}
            label={phaseLabel}
            errorMsg={errorMsg}
          />
        </div>
      )}
    </>
  );
}
