"use client";

import { captureException } from "@sentry/nextjs";
import { useEffect } from "react";
import { Action } from "@/app/(user)/components/ui/Action";

export default function OrchestratorError({
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
      <h2 className="t-15 text-text">Erreur dans l'Orchestrateur</h2>
      <p className="t-13 text-text-muted">
        Impossible de charger l'état du mesh. Vérifie que les fichiers HOM existent et sont
        lisibles.
      </p>
      <p className="t-11 font-mono text-text-ghost max-w-lg break-all">{error.message}</p>
      <Action variant="secondary" tone="neutral" onClick={reset}>
        Réessayer
      </Action>
    </div>
  );
}
