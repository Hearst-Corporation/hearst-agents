"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { Action } from "@/app/(user)/components/ui";

export default function UserError({
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
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="t-13 text-text-muted">Une erreur inattendue s&apos;est produite.</p>
      <Action variant="secondary" tone="neutral" size="sm" onClick={reset}>
        Réessayer
      </Action>
    </div>
  );
}
