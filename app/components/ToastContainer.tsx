"use client";

/**
 * ToastContainer — Global toast stack
 *
 * Renders toasts in a fixed position stack. Mobile-aware positioning
 * (avoids overlap with floating action buttons).
 *
 * Un seul `<div fixed>` (pas de double conteneur). Mobile : toasts collés
 * top + plein largeur (left-4/right-4). Desktop : largeur fixe ancrée à
 * droite. Z-index via token `--z-toast` (= 70) pour rester au-dessus des
 * modales, drawers et backdrops.
 */

import { Toast, type ToastType } from "./Toast";

interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      role="region"
      aria-live="polite"
      aria-label="Notifications"
      className="fixed top-4 right-4 left-4 md:left-auto md:w-[360px] flex flex-col gap-2"
      style={{ zIndex: "var(--z-toast)" as unknown as number }}
    >
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          id={toast.id}
          type={toast.type}
          title={toast.title}
          message={toast.message}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  );
}
