"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Action } from "./components/ui";

export default function UserError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined") {
      console.error("[user] route error:", error);
    }
  }, [error]);

  return (
    <div
      className="h-full w-full flex items-center justify-center"
      style={{ padding: "var(--space-8)" }}
    >
      <div
        className="flex flex-col items-center text-center"
        style={{ gap: "var(--space-4)", maxWidth: "480px" }}
      >
        <span className="t-9 font-mono tabular-nums text-text-faint">
          {error.digest ?? "erreur inattendue"}
        </span>
        <h1 className="t-28 font-light text-text" style={{ margin: 0 }}>
          Quelque chose s&apos;est cassé
        </h1>
        <p className="t-13 font-light text-text-muted" style={{ margin: 0 }}>
          {error.message || "Une erreur est survenue lors du rendu de cette page."} Tu peux réessayer, ou revenir au cockpit.
        </p>
        <div className="flex items-center" style={{ gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
          <Action variant="secondary" tone="neutral" size="sm" onClick={() => router.push("/")}>
            Retour au cockpit
          </Action>
          <Action variant="primary" tone="brand" size="sm" onClick={() => reset()}>
            Réessayer
          </Action>
        </div>
      </div>
    </div>
  );
}
