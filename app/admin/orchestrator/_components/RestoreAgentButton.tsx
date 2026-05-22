"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Action } from "@/app/(user)/components/ui";

export function RestoreAgentButton({ agentId }: { agentId: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    if (!reason.trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/orchestrator/quarantine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent: agentId, action: "restore", reason }),
      });
      if (res.ok) {
        setReason("");
        router.refresh();
      } else {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "Échec de la restauration. Réessaie.");
      }
    });
  };

  return (
    <div className="space-y-(--space-2)">
      <input
        type="text"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Raison de restauration"
        className="w-full px-(--space-3) py-(--space-2) rounded-(--radius-sm) bg-surface-1 border border-(--line) text-text t-12 placeholder:text-text-faint focus:border-(--accent-teal) focus:outline-none transition-colors"
      />
      <Action
        variant="primary"
        tone="brand"
        onClick={submit}
        disabled={isPending || !reason.trim()}
        loading={isPending}
        className="w-full"
      >
        Restaurer l'agent
      </Action>
      {error ? (
        <p className="t-11 text-(--danger)" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
