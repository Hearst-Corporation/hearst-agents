"use client";

import { captureException } from "@sentry/nextjs";
import { useEffect } from "react";
import { Action } from "@/app/(user)/components/ui/Action";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureException(error);
  }, [error]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-8 text-center">
      <p className="t-13 text-text-muted">Erreur dans le panneau admin.</p>
      <Action variant="secondary" tone="neutral" onClick={reset}>
        Réessayer
      </Action>
    </div>
  );
}
