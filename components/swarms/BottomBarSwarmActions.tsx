"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FONT, SPACING } from "@/lib/ui/tokens";

interface BottomBarSwarmActionsProps {
  swarmId: string;
}

/**
 * Actions contextuelles affichées dans la BottomBar sur la route /swarms/[id].
 * Bouton "Run" qui kickoff le swarm en mode on_demand puis redirige vers la page run créée.
 */
export function BottomBarSwarmActions({ swarmId }: BottomBarSwarmActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRun() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/crewai/v1/swarms/${swarmId}/kickoff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trigger: "on_demand" }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => res.statusText);
        throw new Error(`${res.status} — ${body}`);
      }
      const { run_id: runId } = (await res.json()) as { run_id: string };
      router.push(`/swarms/${swarmId}/runs/${runId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setBusy(false);
    }
  }

  return (
    <div
      style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: SPACING.xs }}
    >
      <button
        type="button"
        className="ct-seg-btn primary"
        onClick={handleRun}
        disabled={busy}
        aria-disabled={busy}
        title="Trigger an on_demand run"
      >
        {busy ? "Run…" : "Run"}
      </button>
      {error && (
        <div
          role="alert"
          style={{
            fontSize: FONT.xxs,
            color: "var(--ct-alert-error-text)",
            maxWidth: 240,
            textAlign: "right",
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
