"use client";

/**
 * ToastHost — Renderer global des toasts.
 *
 * Le hook `useToast()` (app/hooks/use-toast.ts) expose `toast.*` qui push
 * dans un singleton `ToastManager`, mais aucun composant ne rendait la
 * file. Tous les `toast.success/error/warning/info` du repo étaient donc
 * invisibles. Ce host monte la stack en bottom-right, gère l'auto-dismiss
 * par type et l'a11y (aria-live).
 *
 * Monté une seule fois dans `app/layout.tsx`, juste avant `</body>`.
 */

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { type ToastType, useToast } from "@/app/hooks/use-toast";

// Durées d'auto-dismiss (ms).
// `error` auto-dismiss après 15s (assez long pour lire) : évite le pile-up
// infini à MAX_TOASTS=5 si plusieurs erreurs surviennent en burst.
const AUTO_DISMISS_MS: Record<ToastType, number | null> = {
  success: 5000,
  info: 5000,
  warning: 8000,
  error: 15000,
};

const ICON: Record<ToastType, string> = {
  success: "✓",
  error: "✕",
  warning: "⚠",
  info: "ⓘ",
};

const ARIA_LIVE: Record<ToastType, "polite" | "assertive"> = {
  success: "polite",
  info: "polite",
  warning: "assertive",
  error: "assertive",
};

// Couleur d'accent par type → token CSS.
const TONE_VAR: Record<ToastType, string> = {
  success: "var(--color-success)",
  error: "var(--danger)",
  warning: "var(--warn)",
  info: "var(--accent-teal)",
};

const TONE_SURFACE: Record<ToastType, string> = {
  success: "var(--color-success-bg)",
  error: "var(--danger-surface)",
  warning: "var(--warn-surface)",
  info: "var(--accent-teal-surface)",
};

const TONE_BORDER: Record<ToastType, string> = {
  success: "var(--color-success-border)",
  error: "var(--danger-border)",
  warning: "var(--warn-border)",
  info: "var(--accent-teal-border)",
};

interface ToastCardProps {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  onDismiss: (id: string) => void;
}

function ToastCard({ id, type, title, message, onDismiss }: ToastCardProps) {
  const duration = AUTO_DISMISS_MS[type];
  // WCAG 2.2.1 — pause auto-dismiss au hover/focus. L'utilisateur a le temps
  // de lire le toast sans qu'il s'évanouisse sous ses yeux.
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (duration === null || paused) return;
    const t = window.setTimeout(() => onDismiss(id), duration);
    return () => window.clearTimeout(t);
  }, [id, duration, onDismiss, paused]);

  // Cap absolu de 60s. Le flag `paused` peut rester true indéfiniment
  // (onglet en arrière-plan, focus stale, hover puis blur sans mouseleave) →
  // le toast bloquerait la stack MAX_TOASTS sans cet override. 60s suffisent
  // pour lire l'erreur la plus longue ; au-delà l'UX se dégrade.
  useEffect(() => {
    if (duration === null) return;
    const HARD_CAP_MS = 60_000;
    const hardCap = window.setTimeout(() => onDismiss(id), HARD_CAP_MS);
    return () => window.clearTimeout(hardCap);
  }, [id, duration, onDismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.96 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      role={type === "error" || type === "warning" ? "alert" : "status"}
      aria-live={ARIA_LIVE[type]}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "var(--space-3)",
        minWidth: "var(--toast-min-width)",
        maxWidth: "var(--toast-max-width)",
        padding: "var(--space-3) var(--space-4)",
        borderRadius: "var(--radius-md)",
        background: TONE_SURFACE[type],
        border: `1px solid ${TONE_BORDER[type]}`,
        backdropFilter: "blur(20px) saturate(140%)",
        WebkitBackdropFilter: "blur(20px) saturate(140%)",
        boxShadow: "var(--shadow-toast)",
        color: "var(--text)",
        pointerEvents: "auto",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          flexShrink: 0,
          marginTop: "var(--space-0-5)",
          fontSize: "14px",
          lineHeight: 1,
          color: TONE_VAR[type],
        }}
      >
        {ICON[type]}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 500,
            fontSize: "13px",
            lineHeight: 1.4,
            color: "var(--text-l0, var(--text))",
          }}
        >
          {title}
        </div>
        {message ? (
          <div
            style={{
              marginTop: "var(--space-1)",
              fontSize: "12px",
              lineHeight: 1.4,
              color: "var(--text-muted)",
            }}
          >
            {message}
          </div>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(id)}
        aria-label="Fermer la notification"
        style={{
          flexShrink: 0,
          width: "var(--space-5)",
          height: "var(--space-5)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "var(--radius-xs)",
          background: "transparent",
          border: "none",
          color: "var(--text-muted)",
          cursor: "pointer",
          fontSize: "14px",
          lineHeight: 1,
          transition: "background 120ms ease, color 120ms ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--toast-close-hover-bg)";
          e.currentTarget.style.color = "var(--text)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "var(--text-muted)";
        }}
      >
        ×
      </button>
    </motion.div>
  );
}

export function ToastHost() {
  const { toasts, dismiss } = useToast();

  return (
    <div
      aria-label="Notifications"
      style={{
        position: "fixed",
        bottom: "var(--space-6)",
        right: "var(--space-6)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
        zIndex: 70,
        pointerEvents: "none",
      }}
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <ToastCard
            key={t.id}
            id={t.id}
            type={t.type}
            title={t.title}
            message={t.message}
            onDismiss={dismiss}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
