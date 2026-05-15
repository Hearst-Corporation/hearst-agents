"use client";

/**
 * VariantEmptyState — État vide d'un onglet : message d'invitation,
 * contrôles spécifiques à la vidéo (provider Runway/HeyGen, ratio,
 * toggle enrichissement) et CTA principal de génération.
 *
 * Les onglets non-vidéo n'affichent que message + CTA.
 */

import type { AssetVariantKind } from "@/lib/assets/variants";
import { Action } from "../ui";
import type { TabCopy, VideoRatio } from "./shared";

export interface VariantEmptyStateProps {
  kind: AssetVariantKind;
  meta: TabCopy;
  generating: boolean;
  enrichLoading: boolean;
  error: string | null;

  // Contrôles vidéo
  videoProvider: "runway" | "heygen";
  setVideoProvider: (p: "runway" | "heygen") => void;
  videoRatio: VideoRatio;
  setVideoRatio: (r: VideoRatio) => void;
  enrichEnabled: boolean;
  setEnrichEnabled: (v: boolean) => void;

  onGenerate: () => void;
}

export function VariantEmptyState({
  kind,
  meta,
  generating,
  enrichLoading,
  error,
  videoProvider,
  setVideoProvider,
  videoRatio,
  setVideoRatio,
  enrichEnabled,
  setEnrichEnabled,
  onGenerate,
}: VariantEmptyStateProps) {
  return (
    <div className="flex flex-col items-start gap-4">
      <p className="t-13 font-light text-text-muted">{meta.empty}</p>
      {kind === "video" && (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-2">
            <span className="t-11 font-medium text-(--text-l1)">Fournisseur</span>
            <select
              value={videoProvider}
              onChange={(e) => setVideoProvider(e.target.value === "heygen" ? "heygen" : "runway")}
              disabled={generating}
              className="px-3 py-2 t-13 font-light text-text bg-[var(--card-flat-bg)] border border-(--border-shell) hover:border-[var(--accent-teal-border-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="runway">Runway (text-to-video)</option>
              <option value="heygen">HeyGen (avatar)</option>
            </select>
          </label>
          {/* [S2-F] Toggle ratio Runway */}
          {videoProvider === "runway" && (
            <div className="flex flex-col gap-2">
              <span className="t-11 font-medium text-(--text-l1)">Format</span>
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => setVideoRatio("1280:720")}
                  disabled={generating}
                  className={`px-3 py-1.5 t-11 font-light border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    videoRatio === "1280:720"
                      ? "border-(--accent-teal) text-(--accent-teal)"
                      : "border-(--border-shell) text-text-muted hover:text-text"
                  }`}
                  style={
                    videoRatio === "1280:720"
                      ? { backgroundColor: "var(--accent-teal-bg-hover)" }
                      : undefined
                  }
                >
                  Paysage
                </button>
                <button
                  type="button"
                  onClick={() => setVideoRatio("720:1280")}
                  disabled={generating}
                  className={`px-3 py-1.5 t-11 font-light border-t border-b border-r transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    videoRatio === "720:1280"
                      ? "border-(--accent-teal) text-(--accent-teal)"
                      : "border-(--border-shell) text-text-muted hover:text-text"
                  }`}
                  style={
                    videoRatio === "720:1280"
                      ? { backgroundColor: "var(--accent-teal-bg-hover)" }
                      : undefined
                  }
                >
                  Portrait
                </button>
              </div>
            </div>
          )}
          {/* [S2-B] Toggle enrichissement automatique (Runway uniquement) */}
          {videoProvider === "runway" && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={enrichEnabled}
                onChange={(e) => setEnrichEnabled(e.target.checked)}
                disabled={generating || enrichLoading}
                className="accent-(--accent-teal)"
              />
              <span className="t-11 font-light text-text-muted">
                Enrichir automatiquement le prompt (Claude Haiku → cinématographique)
              </span>
            </label>
          )}
        </div>
      )}
      <Action
        variant="primary"
        tone="brand"
        onClick={onGenerate}
        loading={generating || enrichLoading}
      >
        {enrichLoading ? "Enrichissement…" : meta.cta}
      </Action>
      {error && <p className="t-13 font-light text-(--danger)">{error}</p>}
    </div>
  );
}
