"use client";

/**
 * EnrichmentPreviewModal — Modal de prévisualisation du prompt enrichi
 * (Claude Haiku → cinématographique) avant génération vidéo Runway.
 *
 * 3 actions : utiliser l'enrichi / garder l'original / modifier
 * manuellement. Annuler ferme la modal sans rien lancer.
 *
 * A11y : focus trap + scroll lock + Escape via `useModalA11y`.
 */

import type React from "react";
import { useModalA11y } from "@/app/(user)/hooks/useModalA11y";

export interface EnrichmentPreviewModalProps {
  preview: { original: string; enriched: string; diff: string[] };
  editingManually: boolean;
  manualPrompt: string;
  setManualPrompt: (v: string) => void;
  setEditingManually: (v: boolean) => void;
  onUseEnriched: () => void;
  onKeepOriginal: () => void;
  onUseManual: () => void;
  onCancel: () => void;
}

export function EnrichmentPreviewModal({
  preview,
  editingManually,
  manualPrompt,
  setManualPrompt,
  setEditingManually,
  onUseEnriched,
  onKeepOriginal,
  onUseManual,
  onCancel,
}: EnrichmentPreviewModalProps) {
  // Hook a11y : focus trap + scroll lock + Escape (annule) + restore focus.
  // Le modal n'est rendu QUE quand `preview` est non-null côté caller, donc
  // isOpen=true tant que ce composant est monté.
  const dialogRef = useModalA11y<HTMLDivElement>(true, {
    onClose: onCancel,
  });

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{
        zIndex: "var(--z-modal)" as unknown as number,
        backgroundColor: "var(--modal-backdrop)",
      }}
      onClick={onCancel}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="enrichment-preview-title"
        className="flex flex-col gap-6 max-w-2xl w-full mx-4 p-6 border border-(--border-shell)"
        style={{ backgroundColor: "var(--card-flat-bg)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-1">
          <span id="enrichment-preview-title" className="t-15 font-medium text-(--text-l1)">
            Prompt enrichi
          </span>
          <span className="t-11 font-light text-text-muted">
            Claude a réécrit votre prompt en direction cinématographique. Vérifiez avant génération.
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <span className="t-11 font-medium text-text-muted">Original</span>
          <p className="t-13 font-light text-text-muted whitespace-pre-wrap">{preview.original}</p>
        </div>

        <div className="flex flex-col gap-2">
          <span className="t-11 font-medium text-(--accent-teal)">Enrichi</span>
          <p className="t-13 font-light text-text whitespace-pre-wrap">
            {renderEnrichedWithDiff(preview.enriched, preview.diff)}
          </p>
        </div>

        {editingManually && (
          <div className="flex flex-col gap-2">
            <span className="t-11 font-medium text-(--text-l1)">Modification manuelle</span>
            <textarea
              value={manualPrompt}
              onChange={(e) => setManualPrompt(e.target.value)}
              rows={4}
              className="px-3 py-2 t-13 font-light text-text bg-[var(--surface-1)] border border-(--border-shell) hover:border-[var(--accent-teal-border-hover)] focus:border-(--accent-teal) outline-none transition-colors resize-y"
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-2 flex-wrap">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 t-11 font-light border border-(--border-shell) text-text-muted transition-colors hover:text-text"
          >
            Annuler
          </button>
          {!editingManually ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setManualPrompt(preview.enriched);
                  setEditingManually(true);
                }}
                className="px-3 py-1.5 t-11 font-light border border-(--border-shell) text-text-muted transition-colors hover:text-text"
              >
                Modifier manuellement
              </button>
              <button
                type="button"
                onClick={onKeepOriginal}
                className="px-3 py-1.5 t-11 font-light border border-(--border-shell) text-text transition-colors hover:border-(--accent-teal) hover:text-(--accent-teal)"
              >
                Garder l&apos;original
              </button>
              <button
                type="button"
                onClick={onUseEnriched}
                className="px-3 py-1.5 t-11 font-medium border border-(--accent-teal) text-(--accent-teal) transition-colors"
                style={{ backgroundColor: "var(--accent-teal-bg-hover)" }}
              >
                Utiliser l&apos;enrichi
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onUseManual}
              disabled={manualPrompt.trim().length === 0}
              className="px-3 py-1.5 t-11 font-medium border border-(--accent-teal) text-(--accent-teal) transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ backgroundColor: "var(--accent-teal-bg-hover)" }}
            >
              Utiliser ma version
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Surligne les fragments du diff dans le texte enrichi pour l'UI. */
function renderEnrichedWithDiff(enriched: string, diff: string[]): React.ReactNode {
  if (diff.length === 0) return enriched;

  // Construction d'une regex qui capture tous les fragments du diff
  // (escape des chars spéciaux). On split en gardant les matchs, et on
  // surligne ceux qui correspondent à un fragment du diff.
  const escapedFragments = diff
    .map((f) => f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .filter((f) => f.length > 0);
  if (escapedFragments.length === 0) return enriched;

  const pattern = new RegExp(`(${escapedFragments.join("|")})`, "gi");
  const parts = enriched.split(pattern);

  return parts.map((part, idx) => {
    const isMatch = diff.some((f) => f.toLowerCase() === part.toLowerCase());
    if (isMatch) {
      return (
        <span
          key={idx}
          className="text-(--accent-teal)"
          style={{
            backgroundColor: "var(--accent-teal-bg-hover)",
            padding: "0 var(--space-1)",
          }}
        >
          {part}
        </span>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}
