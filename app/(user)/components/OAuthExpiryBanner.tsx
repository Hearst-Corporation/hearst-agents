"use client";

/**
 * OAuthExpiryBanner — Bandeau alerte tokens OAuth expirants.
 *
 * Depuis 2026-05-10 : plus rendu globalement dans le layout (mangeait
 * 48px sur tous les Stages). À utiliser uniquement in-page (ex: en tête
 * de /apps). L'état système global se consomme via le badge dot sur
 * l'item Apps de la TimelineRail (voir useOAuthExpiry).
 */

import { useState } from "react";
import { AUTH_EXPIRING_DAYS_THRESHOLD } from "@/lib/connections/oauth-constants";
import { useOAuthExpiry } from "@/app/hooks/use-oauth-expiry";

export function OAuthExpiryBanner() {
  const { connections, loaded } = useOAuthExpiry();
  const [dismissed, setDismissed] = useState(false);

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
