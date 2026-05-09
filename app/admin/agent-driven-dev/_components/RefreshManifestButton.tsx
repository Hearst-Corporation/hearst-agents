"use client";
import { useState } from "react";

export default function RefreshManifestButton() {
  const [busy, setBusy] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null);

  const refresh = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/features-manifest", { method: "POST" });
      if (res.ok) {
        setLastRefreshed(new Date().toLocaleTimeString("fr-FR"));
        window.location.reload();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-(--space-3)">
      <button
        type="button"
        onClick={refresh}
        disabled={busy}
        className="px-(--space-3) py-(--space-2) rounded-(--radius-sm) border border-line t-12 text-text-muted hover:text-text hover:border-(--accent-teal)/40 transition-colors disabled:opacity-50"
      >
        {busy ? "Régénération…" : "↻ Régénérer manifest"}
      </button>
      {lastRefreshed && (
        <span className="t-10 text-text-ghost">mis à jour à {lastRefreshed}</span>
      )}
    </div>
  );
}
