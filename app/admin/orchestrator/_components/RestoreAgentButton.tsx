"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function RestoreAgentButton({ agentId }: { agentId: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    if (!reason.trim()) return;
    startTransition(async () => {
      const res = await fetch("/api/orchestrator/quarantine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent: agentId, action: "restore", reason }),
      });
      if (res.ok) {
        setReason("");
        router.refresh();
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
      <button
        type="button"
        onClick={submit}
        disabled={isPending || !reason.trim()}
        className="w-full px-(--space-3) py-(--space-2) rounded-(--radius-sm) bg-(--accent-teal) text-(--text-on-accent-teal) t-12 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? "Restauration…" : "Restaurer l'agent"}
      </button>
    </div>
  );
}
