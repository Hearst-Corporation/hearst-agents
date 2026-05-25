"use client";
import { useState } from "react";
import { Action } from "@/app/(user)/components/ui";

export default function RefreshManifestButton() {
  const [busy, setBusy] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null);

  const refresh = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/features-manifest", { method: "POST" });
      if (res.ok) {
        setLastRefreshed(new Date().toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris" }));
        window.location.reload();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-(--space-3)">
      <Action
        variant="secondary"
        tone="neutral"
        size="sm"
        onClick={refresh}
        disabled={busy}
        loading={busy}
      >
        ↻ Régénérer manifest
      </Action>
      {lastRefreshed && <span className="t-10 text-text-ghost">mis à jour à {lastRefreshed}</span>}
    </div>
  );
}
