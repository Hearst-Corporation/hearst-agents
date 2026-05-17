"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-8 text-center">
      <p className="t-13 text-text-muted">Erreur dans le panneau admin.</p>
      <button
        type="button"
        onClick={reset}
        className="t-12 rounded-(--radius-sm) border border-(--border-shell) px-(--space-4) py-(--space-2) text-text-muted hover:text-text transition-colors"
      >
        Réessayer
      </button>
    </div>
  );
}
