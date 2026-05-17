"use client";

/**
 * ConfirmModal — modal de confirmation pour les actions destructives.
 *
 * Comportement :
 *   - Backdrop centré + dialog focus-trap léger
 *   - ESC pour annuler
 *   - Bouton "Confirmer" coloré selon `variant` ("danger" | "primary")
 *   - Bouton "Annuler" toujours présent
 *
 * Tokens uniquement (CLAUDE.md §1) — couleurs / spacing / radius via
 * `var(--*)`.
 */

import { useEffect } from "react";
import { useModalA11y } from "@/app/(user)/hooks/useModalA11y";
import { Action } from "./ui";

export interface ConfirmModalProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "primary" | "danger";
  /**
   * État "soumission en cours". Quand `true` :
   *   - le bouton confirm passe en spinner et est `disabled`
   *   - le bouton cancel est `disabled`
   *   - Escape n'appelle PAS `onCancel` (cf. useModalA11y.onClose ci-dessous)
   *   - le clic sur le backdrop est ignoré
   * Garantit qu'une action destructive en cours ne peut pas être interrompue
   * par un Escape ou un clic accidentel — évite les états zombies si l'API
   * répond après que le user ait fermé la modale.
   */
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  variant = "danger",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  // Le hook gère focus trap, scroll lock, restore focus, Escape (avec
  // garde-fou loading via closeOnEscape). On désactive autoFocus pour
  // poser le focus initial sur le bouton "Annuler" (option safe).
  const dialogRef = useModalA11y<HTMLDivElement>(open, {
    onClose: () => {
      if (!loading) onCancel();
    },
    autoFocus: false,
  });

  // useModalA11y autoFocus=false : on focus explicitement le cancel pour
  // pattern safe-default. Pas de race avec autoFocus du hook (désactivé
  // ci-dessus) — cet effect est l'unique source de focus initial dans
  // l'ouverture de la modale.
  useEffect(() => {
    if (!open) return;
    // Focus initial sur le bouton "Annuler" (option safe par défaut).
    const cancelBtn = dialogRef.current?.querySelector<HTMLButtonElement>(
      "[data-testid='confirm-modal-cancel']",
    );
    cancelBtn?.focus();
  }, [open, dialogRef]);

  if (!open) return null;

  const isDanger = variant === "danger";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      data-testid="confirm-modal"
      aria-disabled={loading ? "true" : undefined}
      className="fixed inset-0 flex items-center justify-center"
      style={{
        zIndex: "var(--z-modal)" as unknown as number,
        // Backdrop : color-mix sur le shell ambient (--bg) pour rester token-only.
        // Pendant loading on assombrit un cran + curseur "wait" pour signaler
        // que la modale est verrouillée (Escape et click-outside ignorés).
        background: loading
          ? "color-mix(in srgb, var(--bg) 80%, transparent)"
          : "color-mix(in srgb, var(--bg) 70%, transparent)",
        cursor: loading ? "wait" : undefined,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        className="flex flex-col"
        style={{
          minWidth: "var(--space-80, 320px)",
          maxWidth: "var(--space-96, 400px)",
          padding: "var(--space-6)",
          gap: "var(--space-4)",
          background: "var(--surface-1)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-md)",
          boxShadow: "var(--shadow-card-hover)",
        }}
      >
        <h2
          id="confirm-modal-title"
          className="t-15 font-medium text-text"
          style={{ lineHeight: "var(--leading-snug)" }}
        >
          {title}
        </h2>
        {description && (
          <p
            className="t-13 font-light text-text-muted m-0"
            style={{ lineHeight: "var(--leading-relaxed)" }}
          >
            {description}
          </p>
        )}
        <div className="flex items-center justify-end" style={{ gap: "var(--space-2)" }}>
          <Action
            variant="secondary"
            tone="neutral"
            size="sm"
            onClick={onCancel}
            disabled={loading}
            testId="confirm-modal-cancel"
          >
            {cancelLabel}
          </Action>
          <Action
            variant="primary"
            tone={isDanger ? "danger" : "brand"}
            size="sm"
            onClick={onConfirm}
            loading={loading}
            disabled={loading}
            testId="confirm-modal-confirm"
          >
            {confirmLabel}
          </Action>
        </div>
      </div>
    </div>
  );
}
