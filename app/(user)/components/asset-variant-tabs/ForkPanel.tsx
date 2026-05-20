"use client";

/**
 * ForkPanel — [S2-C] Mini-panel "Modifier" pré-rempli avec le prompt
 * d'origine. L'user fait un delta, le système crée un nouveau variant
 * via `derivedFrom` (lineage B4) sans toucher l'original.
 */

import type { ForkPanelState } from "./shared";

export interface ForkPanelProps {
  state: ForkPanelState;
  setState: (s: ForkPanelState | null) => void;
  onSubmit: () => void;
  generating: boolean;
}

export function ForkPanel({ state, setState, onSubmit, generating }: ForkPanelProps) {
  const isVideo = state.parentKind === "video";
  return (
    <div
      className="mt-4 flex flex-col gap-4 p-4 border border-(--border-shell)"
      style={{ backgroundColor: "var(--card-flat-bg)" }}
    >
      <div className="flex items-baseline justify-between">
        <span className="t-13 font-medium text-text-l1">Modifier ce variant</span>
        <span className="t-11 font-light text-text-muted">
          Lineage : nouveau variant dérivé de l&apos;original
        </span>
      </div>

      <label className="flex flex-col gap-2">
        <span className="t-11 font-medium text-text-l1">Prompt</span>
        <textarea
          value={state.prompt}
          onChange={(e) => setState({ ...state, prompt: e.target.value })}
          rows={4}
          disabled={generating}
          className="px-3 py-2 t-13 font-light text-text bg-[var(--surface-1)] border border-(--border-shell) hover:border-[var(--accent-teal-border-hover)] focus:border-(--accent-teal) outline-none transition-colors resize-y disabled:opacity-50"
        />
      </label>

      {isVideo && (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-2">
            <span className="t-11 font-medium text-text-l1">
              Durée (secondes) : {state.duration}
            </span>
            <input
              type="range"
              min={3}
              max={10}
              step={1}
              value={state.duration}
              onChange={(e) => setState({ ...state, duration: Number(e.target.value) })}
              disabled={generating}
              className="accent-(--accent-teal)"
            />
          </label>

          <div className="flex flex-col gap-2">
            <span className="t-11 font-medium text-text-l1">Format</span>
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => setState({ ...state, ratio: "1280:720" })}
                disabled={generating}
                className={`px-3 py-1.5 t-11 font-light border transition-colors disabled:opacity-50 ${
                  state.ratio === "1280:720"
                    ? "border-(--accent-teal) text-(--accent-teal)"
                    : "border-(--border-shell) text-text-muted hover:text-text"
                }`}
                style={
                  state.ratio === "1280:720"
                    ? { backgroundColor: "var(--accent-teal-bg-hover)" }
                    : undefined
                }
              >
                Paysage
              </button>
              <button
                type="button"
                onClick={() => setState({ ...state, ratio: "720:1280" })}
                disabled={generating}
                className={`px-3 py-1.5 t-11 font-light border-t border-b border-r transition-colors disabled:opacity-50 ${
                  state.ratio === "720:1280"
                    ? "border-(--accent-teal) text-(--accent-teal)"
                    : "border-(--border-shell) text-text-muted hover:text-text"
                }`}
                style={
                  state.ratio === "720:1280"
                    ? { backgroundColor: "var(--accent-teal-bg-hover)" }
                    : undefined
                }
              >
                Portrait
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setState(null)}
          disabled={generating}
          className="px-3 py-1.5 t-11 font-light border border-(--border-shell) text-text-muted transition-colors hover:text-text disabled:opacity-50"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={generating || state.prompt.trim().length === 0}
          className="px-3 py-1.5 t-11 font-medium border border-(--accent-teal) text-(--accent-teal) transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ backgroundColor: "var(--accent-teal-bg-hover)" }}
        >
          {generating ? "Régénération…" : "Régénérer avec ces modifications"}
        </button>
      </div>
    </div>
  );
}
