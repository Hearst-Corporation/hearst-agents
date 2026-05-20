"use client";

/**
 * EnrichmentPreviewModal — Modal de prévisualisation du prompt enrichi
 * (Claude Haiku → cinématographique) avant génération vidéo Runway.
 *
 * 3 actions : utiliser l'enrichi / garder l'original / modifier
 * manuellement. Annuler ferme la modal sans rien lancer.
 *
 * A11y : focus trap + scroll lock + Escape via ModalShell (useModalA11y interne).
 */

import type React from "react";
import { Action, ModalShell } from "@/app/(user)/components/ui";

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
  return (
    <ModalShell
      open={true}
      onClose={onCancel}
      labelledBy="enrichment-preview-title"
      backdropStyle={{ background: "var(--modal-backdrop)" }}
      a11yOptions={{ onClose: onCancel }}
    >
      <div
        className="flex flex-col gap-6 max-w-2xl w-full mx-4 p-6 border border-(--border-shell)"
        style={{ backgroundColor: "var(--card-flat-bg)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-1">
          <h2 id="enrichment-preview-title" className="t-15 font-medium text-(--text-l1)">
            Prompt enrichi
          </h2>
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
              className="px-3 py-2 t-13 font-light text-text bg-(--surface-1) border border-(--border-shell) hover:border-(--accent-teal-border-hover) focus:border-(--accent-teal) outline-none transition-colors resize-y"
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-2 flex-wrap">
          <Action variant="secondary" tone="neutral" size="sm" onClick={onCancel}>
            Annuler
          </Action>
          {!editingManually ? (
            <>
              <Action
                variant="secondary"
                tone="neutral"
                size="sm"
                onClick={() => {
                  setManualPrompt(preview.enriched);
                  setEditingManually(true);
                }}
              >
                Modifier manuellement
              </Action>
              <Action variant="secondary" tone="neutral" size="sm" onClick={onKeepOriginal}>
                Garder l&apos;original
              </Action>
              <Action variant="primary" tone="brand" size="sm" onClick={onUseEnriched}>
                Utiliser l&apos;enrichi
              </Action>
            </>
          ) : (
            <Action
              variant="primary"
              tone="brand"
              size="sm"
              onClick={onUseManual}
              disabled={manualPrompt.trim().length === 0}
            >
              Utiliser ma version
            </Action>
          )}
        </div>
      </div>
    </ModalShell>
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
