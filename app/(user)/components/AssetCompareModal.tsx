"use client";

/**
 * AssetCompareModal — saisie des 2 IDs d'assets à comparer.
 *
 * Remplace le double `window.prompt()` du Commandeur par une modale
 * tokens-first cohérente avec ConfirmModal :
 *   - backdrop scrim, dialog centré, focus trap (useModalA11y)
 *   - 2 inputs neutres (pas de halo cyan), bouton "Comparer" disabled
 *     tant que les 2 IDs ne sont pas remplis
 *   - Escape annule, click backdrop annule
 *
 * Tokens uniquement (CLAUDE.md §1).
 */

import { useState } from "react";
import { useModalA11y } from "@/app/(user)/hooks/useModalA11y";
import { Action } from "./ui";

export interface AssetCompareModalProps {
  open: boolean;
  onCancel: () => void;
  onCompare: (idA: string, idB: string) => void;
}

export function AssetCompareModal({ open, onCancel, onCompare }: AssetCompareModalProps) {
  const [idA, setIdA] = useState("");
  const [idB, setIdB] = useState("");

  // Reset des champs à la fermeture pour ne pas garder de valeurs
  // périmées entre deux ouvertures (pattern direct au lieu d'un useEffect
  // setState : éviter le cascading render React 19).
  function handleCancel() {
    setIdA("");
    setIdB("");
    onCancel();
  }

  // Focus trap + scroll lock + Escape + restore focus.
  // autoFocus=false : on pose nous-même le focus sur l'input A via <input autoFocus>.
  const dialogRef = useModalA11y<HTMLDivElement>(open, {
    onClose: handleCancel,
    autoFocus: false,
  });

  if (!open) return null;

  const trimmedA = idA.trim();
  const trimmedB = idB.trim();
  const canSubmit = trimmedA !== "" && trimmedB !== "";

  function submit() {
    if (!canSubmit) return;
    setIdA("");
    setIdB("");
    onCompare(trimmedA, trimmedB);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="asset-compare-title"
      data-testid="asset-compare-modal"
      className="fixed inset-0 flex items-center justify-center"
      style={{
        zIndex: "var(--z-modal)" as unknown as number,
        background: "color-mix(in srgb, var(--bg) 70%, transparent)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleCancel();
      }}
    >
      <div
        ref={dialogRef}
        className="flex flex-col"
        style={{
          minWidth: "var(--space-96, 400px)",
          maxWidth: "var(--space-128, 520px)",
          padding: "var(--space-6)",
          gap: "var(--space-4)",
          background: "var(--surface-1)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-md)",
          boxShadow: "var(--shadow-card-hover)",
        }}
      >
        <h2
          id="asset-compare-title"
          className="t-15 font-medium text-text"
          style={{ lineHeight: "var(--leading-snug)" }}
        >
          Comparer deux assets
        </h2>
        <p
          className="t-13 font-light text-text-muted m-0"
          style={{ lineHeight: "var(--leading-relaxed)" }}
        >
          Indique les identifiants des deux assets à mettre côte à côte.
        </p>

        <div className="flex flex-col" style={{ gap: "var(--space-3)" }}>
          <label className="flex flex-col" style={{ gap: "var(--space-1)" }}>
            <span className="t-11 font-light text-text-muted">Asset A</span>
            <input
              type="text"
              value={idA}
              onChange={(e) => setIdA(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canSubmit) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder="asset-id-a"
              data-testid="asset-compare-input-a"
              className="t-13 font-light outline-none focus-visible:ring-1 focus-visible:ring-(--accent-teal-border-hover)"
              style={{
                padding: "var(--space-2) var(--space-3)",
                background: "var(--surface-2)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-xs)",
                color: "var(--text)",
              }}
            />
          </label>
          <label className="flex flex-col" style={{ gap: "var(--space-1)" }}>
            <span className="t-11 font-light text-text-muted">Asset B</span>
            <input
              type="text"
              value={idB}
              onChange={(e) => setIdB(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canSubmit) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder="asset-id-b"
              data-testid="asset-compare-input-b"
              className="t-13 font-light outline-none focus-visible:ring-1 focus-visible:ring-(--accent-teal-border-hover)"
              style={{
                padding: "var(--space-2) var(--space-3)",
                background: "var(--surface-2)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-xs)",
                color: "var(--text)",
              }}
            />
          </label>
        </div>

        <div className="flex items-center justify-end" style={{ gap: "var(--space-2)" }}>
          <Action
            variant="secondary"
            tone="neutral"
            size="sm"
            onClick={handleCancel}
            testId="asset-compare-cancel"
          >
            Annuler
          </Action>
          <Action
            variant="primary"
            tone="brand"
            size="sm"
            onClick={submit}
            disabled={!canSubmit}
            testId="asset-compare-submit"
          >
            Comparer
          </Action>
        </div>
      </div>
    </div>
  );
}
