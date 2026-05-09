"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function StartRunButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<{ run_id: string; decision: string } | null>(null);

  const launch = () => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/orchestrator/runs/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scope: ["architecture", "design-system", "qa"] }),
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = (await res.json()) as { run_id: string; decision: string };
        setLastRun(data);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "erreur inconnue");
      }
    });
  };

  return (
    <div className="space-y-(--space-3)">
      <button
        type="button"
        onClick={launch}
        disabled={isPending}
        className="w-full px-(--space-4) py-(--space-3) rounded-(--radius-md) bg-(--accent-teal) text-(--text-on-accent-teal) t-13 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
      >
        {isPending ? "Run en cours…" : "Lancer un run"}
      </button>
      {error ? (
        <p className="t-11 text-(--danger) font-mono">Erreur : {error}</p>
      ) : null}
      {lastRun ? (
        <p className="t-11 text-text-muted font-mono">
          ✓ run <span className="text-text">{lastRun.run_id}</span> · {lastRun.decision}
        </p>
      ) : null}
    </div>
  );
}
