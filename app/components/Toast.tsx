"use client";

import { type ReactNode, useEffect } from "react";
import {
  GhostIconAlert,
  GhostIconCheck,
  GhostIconInfo,
  GhostIconX,
} from "@/app/(user-legacy)/components/ghost-icons";

export type ToastType = "info" | "success" | "error" | "warning";

export interface ToastProps {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  onDismiss: (id: string) => void;
}

const TYPE_STYLES: Record<ToastType, { border: string; text: string; icon: ReactNode }> = {
  info: {
    border: "border-b border-(--accent-teal)",
    text: "text-text",
    icon: <GhostIconInfo className="w-4 h-4 text-(--accent-teal)" />,
  },
  success: {
    border: "border-b border-[var(--money)]",
    text: "text-text",
    icon: <GhostIconCheck className="w-4 h-4 text-(--money)" />,
  },
  error: {
    border: "border-b border-(--danger)",
    text: "text-text",
    icon: <GhostIconAlert className="w-4 h-4 text-(--danger)" />,
  },
  warning: {
    border: "border-b border-(--warn)",
    text: "text-text",
    icon: <GhostIconAlert className="w-4 h-4 text-(--warn)" />,
  },
};

export function Toast({ id, type, title, message, duration = 5000, onDismiss }: ToastProps) {
  const styles = TYPE_STYLES[type];

  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(id);
    }, duration);
    return () => clearTimeout(timer);
  }, [id, duration, onDismiss]);

  return (
    <div
      className={`relative flex items-start gap-3 p-4 border-t border-[var(--ghost-modal-top)] bg-bg-elev animate-in slide-in-from-right-full duration-300 ${styles.border}`}
      role="alert"
    >
      <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center mt-0.5">
        {styles.icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className={`t-13 font-medium ${styles.text}`}>{title}</p>
        {message && <p className="t-11 text-text-muted mt-1 line-clamp-2 font-light">{message}</p>}
      </div>
      <button
        onClick={() => onDismiss(id)}
        className="flex-shrink-0 text-text-faint hover:text-text transition-colors p-0.5"
        aria-label="Fermer"
      >
        <GhostIconX className="w-4 h-4" />
      </button>
    </div>
  );
}
