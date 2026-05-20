"use client";

/**
 * ConfirmDialog — dialogue de confirmation interne au package cockpit-shell.
 *
 * Pas de dépendance externe (ni Radix, ni react-aria).
 * Styles inline uniquement — le package n'a pas Tailwind au build time.
 * Conforme a11y : role=dialog, aria-modal, focus trap, Escape, restore focus.
 */

import { useEffect, useRef, useState } from "react";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Annuler",
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<Element | null>(null);

  // Stocke le focus actif au moment de l'ouverture, le restaure à la fermeture
  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement;
      // Focus sur Cancel — action moins dangereuse
      requestAnimationFrame(() => {
        cancelRef.current?.focus();
      });
    } else {
      if (
        previousFocusRef.current &&
        typeof (previousFocusRef.current as HTMLElement).focus === "function"
      ) {
        (previousFocusRef.current as HTMLElement).focus();
      }
      setIsConfirming(false);
    }
  }, [open]);

  // Focus trap + Escape
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
        return;
      }

      if (e.key === "Tab") {
        const cancel = cancelRef.current;
        const confirm = confirmRef.current;
        if (!cancel || !confirm) return;

        e.preventDefault();
        if (e.shiftKey) {
          // Shift+Tab : cycle inverse
          if (document.activeElement === cancel) {
            confirm.focus();
          } else {
            cancel.focus();
          }
        } else {
          // Tab : cycle normal
          if (document.activeElement === confirm) {
            cancel.focus();
          } else {
            confirm.focus();
          }
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  async function handleConfirm() {
    setIsConfirming(true);
    try {
      await onConfirm();
    } finally {
      setIsConfirming(false);
    }
  }

  const titleId = "ct-confirm-dialog-title";
  const descId = description ? "ct-confirm-dialog-desc" : undefined;

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1000,
          background: "rgba(0,0,0,0.55)",
        }}
        aria-hidden="true"
        onClick={onCancel}
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 1001,
          width: "min(440px, calc(100vw - 48px))",
          background: "var(--ct-surface-0, rgba(255,255,255,0.02))",
          backdropFilter: "blur(40px) saturate(120%)",
          WebkitBackdropFilter: "blur(40px) saturate(120%)",
          border: "1px solid var(--ct-border-strong, rgba(255,255,255,0.16))",
          borderRadius: "12px",
          padding: "28px 28px 24px",
          boxShadow: "0 24px 64px -16px rgba(0,0,0,0.72), inset 0 1px 0 rgba(255,255,255,0.12)",
          color: "var(--ct-text-primary, rgba(245,245,245,0.92))",
          fontFamily:
            '"Inter", -apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif',
        }}
      >
        {/* Titre */}
        <p
          id={titleId}
          style={{
            margin: "0 0 8px",
            fontSize: "16px",
            fontWeight: 600,
            color: "var(--ct-text-strong, #ffffff)",
            lineHeight: 1.35,
          }}
        >
          {title}
        </p>

        {/* Description */}
        {description && (
          <p
            id={descId}
            style={{
              margin: "0 0 24px",
              fontSize: "13px",
              color: "var(--ct-text-muted, rgba(245,245,245,0.48))",
              lineHeight: 1.5,
            }}
          >
            {description}
          </p>
        )}
        {!description && <div style={{ marginBottom: "24px" }} />}

        {/* Boutons */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "10px",
          }}
        >
          {/* Cancel */}
          <button
            ref={cancelRef}
            type="button"
            disabled={isConfirming}
            onClick={onCancel}
            style={{
              appearance: "none",
              fontFamily: "inherit",
              fontSize: "13px",
              fontWeight: 500,
              cursor: isConfirming ? "not-allowed" : "pointer",
              padding: "8px 18px",
              borderRadius: "8px",
              border: "1px solid var(--ct-border-strong, rgba(255,255,255,0.16))",
              background: "var(--ct-surface-2, rgba(255,255,255,0.06))",
              color: "var(--ct-text-body, rgba(245,245,245,0.72))",
              opacity: isConfirming ? 0.5 : 1,
              transition: "background 120ms ease, opacity 120ms ease",
            }}
          >
            {cancelLabel}
          </button>

          {/* Confirm */}
          <button
            ref={confirmRef}
            type="button"
            disabled={isConfirming}
            onClick={handleConfirm}
            style={{
              appearance: "none",
              fontFamily: "inherit",
              fontSize: "13px",
              fontWeight: 600,
              cursor: isConfirming ? "not-allowed" : "pointer",
              padding: "8px 18px",
              borderRadius: "8px",
              border: danger
                ? "1px solid rgba(220,38,38,0.55)"
                : "1px solid var(--ct-border-accent, rgba(138,21,56,0.55))",
              background: danger
                ? "rgba(185,28,28,0.75)"
                : "var(--ct-accent-soft, rgba(138,21,56,0.18))",
              color: danger ? "#fca5a5" : "var(--ct-accent-strong, rgba(138,21,56,0.78))",
              opacity: isConfirming ? 0.65 : 1,
              transition: "background 120ms ease, opacity 120ms ease",
            }}
          >
            {isConfirming ? "Confirmation…" : confirmLabel}
          </button>
        </div>
      </div>
    </>
  );
}
