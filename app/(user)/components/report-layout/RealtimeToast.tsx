/**
 * RealtimeToast — bandeau "Rapport rafraîchi" affiché 3s lorsque le payload
 * Supabase live remplace l'initial. Pure présentation, pas de logique.
 */

import type { JSX } from "react";

export function RealtimeToast(): JSX.Element {
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="report-realtime-toast"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2)",
        marginBottom: "var(--space-3)",
        padding: "var(--space-2) var(--space-4)",
        background: "color-mix(in srgb, var(--accent-teal) 12%, transparent)",
        border: "1px solid var(--accent-teal)",
        borderRadius: "var(--radius-xs)",
        transition: "opacity var(--duration-fast) var(--ease-standard)",
      }}
    >
      <span className="t-11 font-medium text-(--accent-teal)">
        Rapport rafraîchi automatiquement
      </span>
    </div>
  );
}
