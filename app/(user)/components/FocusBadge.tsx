"use client";

/**
 * FocusBadge — Mini-overlay flottant indiquant le Mode Focus actif (S4-B).
 *
 * Apparaît en haut à droite quand `useFocusMode.enabled` est true.
 * Cliquer dessus (ou presser ESC) désactive le mode focus.
 *
 * Style discret : fond `--surface-1`, point teal pulsant,
 * micro-typo `t-11 font-light`. Z-index élevé pour rester au-dessus
 * du Stage central qui occupe désormais 100vw.
 */

import { useFocusMode } from "@/stores/focus-mode";

export function FocusBadge() {
  const enabled = useFocusMode((s) => s.enabled);
  const disable = useFocusMode((s) => s.disable);

  if (!enabled) return null;

  return (
    <button
      type="button"
      onClick={disable}
      aria-label="Désactiver le mode focus (Échap)"
      className="fixed flex items-center cursor-pointer"
      style={{
        top: "var(--space-3)",
        right: "var(--space-3)",
        zIndex: 60,
        padding: "var(--space-2) var(--space-3)",
        background: "var(--surface-1)",
        color: "var(--text-muted)",
        borderRadius: "var(--radius-pill)",
        border: "1px solid var(--line)",
        gap: "var(--space-2)",
        backdropFilter: "blur(8px)",
        transition:
          "background var(--duration-base) var(--ease-standard), color var(--duration-base) var(--ease-standard)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--surface-2)";
        e.currentTarget.style.color = "var(--text)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "var(--surface-1)";
        e.currentTarget.style.color = "var(--text-muted)";
      }}
    >
      <span
        aria-hidden
        style={{
          width: "var(--size-dot)",
          height: "var(--size-dot)",
          borderRadius: "var(--radius-full)",
          background: "var(--accent-teal)",
          boxShadow: "var(--shadow-pulse-dot)",
          animation:
            "pipeline-port-pulse var(--duration-slow) var(--ease-out-soft) infinite alternate",
        }}
      />
      <span className="t-11 font-light">Mode focus actif · Échap</span>
    </button>
  );
}
