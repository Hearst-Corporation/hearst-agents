"use client";

import { useState, useEffect } from "react";
import {
  AUTH_EXPIRING_DAYS_THRESHOLD,
  type ExpiringConnection,
} from "@/lib/connections/oauth-constants";

export function OAuthExpiryBanner() {
  const [connections, setConnections] = useState<ExpiringConnection[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/connections/expiring", {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) return;
        const data: { connections: ExpiringConnection[] } = await res.json();
        if (!cancelled && Array.isArray(data.connections)) {
          setConnections(data.connections);
        }
      } catch {
        // Silencieux — le banner est non-critique
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  if (!loaded || dismissed || connections.length === 0) return null;

  const count = connections.length;
  const plural = count > 1 ? "connexions expirent" : "connexion expire";

  const firstService = connections[0];
  const serviceLabel = firstService?.appName ?? "";
  const serviceStatus = firstService?.status === "expired" ? "expiré" : "expire bientôt";

  return (
    <div
      role="alert"
      className="flex items-center shrink-0"
      style={{
        padding: "0 var(--space-4)",
        height: "var(--space-8)",
        borderBottom: "1px solid var(--border-soft)",
        gap: "var(--space-3)",
      }}
    >
      {/* Dot accent-teal — indicateur système calme */}
      <span
        className="shrink-0 rounded-pill"
        style={{
          width: "var(--space-1)",
          height: "var(--space-1)",
          background: "var(--accent-teal)",
        }}
        aria-hidden
      />

      {/* Message inline */}
      <span className="t-11 font-light flex-1 min-w-0 truncate" style={{ color: "var(--text-l2)" }}>
        {count} {plural} dans moins de {AUTH_EXPIRING_DAYS_THRESHOLD}j —
      </span>

      {/* Service + statut */}
      <span className="t-11 font-light shrink-0 hidden sm:inline" style={{ color: "var(--text-faint)" }}>
        {serviceLabel} {serviceStatus}
      </span>

      {/* CTA */}
      <a
        href="/apps"
        className="t-11 font-medium shrink-0 transition-opacity hover:opacity-70"
        style={{ color: "var(--text-l1)" }}
      >
        Reconnecter
      </a>

      {/* Dismiss */}
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="shrink-0 flex items-center justify-center transition-opacity hover:opacity-70"
        style={{ color: "var(--text-faint)", background: "transparent", border: "none", cursor: "pointer" }}
        aria-label="Masquer"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
          <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
