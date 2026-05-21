"use client";

/**
 * HubBar — barre de hub en bas avec label + segments.
 *
 * Label "Cockpit" + segments Overview / Catalog
 */

import { useCallback } from "react";
import { useStageStore } from "@/stores/stage";

const HUB_SEGMENTS = [
  { id: "overview", label: "Overview" },
  { id: "catalog", label: "Catalog" },
];

export function HubBar() {
  const currentMode = useStageStore((s) => s.current.mode);

  const isActive = useCallback(
    (id: string) => {
      if (id === "overview") return currentMode === "cockpit";
      return false;
    },
    [currentMode],
  );

  return (
    <div
      className="ct-hub-bar"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        padding: "var(--space-2-5) 0",
        borderTop: "1px solid var(--border-shell)",
        marginTop: "var(--space-2)",
      }}
    >
      <span
        style={{
          fontSize: "var(--font-size-10, 10px)",
          fontWeight: 600,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--text-faint)",
        }}
      >
        Cockpit
      </span>
      <div
        style={{
          display: "flex",
          gap: "var(--space-0-5)",
          background: "var(--surface-1)",
          borderRadius: "var(--radius-sm)",
          padding: "var(--space-0-5)",
        }}
      >
        {HUB_SEGMENTS.map((seg) => {
          const active = isActive(seg.id);
          return (
            <button
              key={seg.id}
              type="button"
              style={{
                padding: "var(--space-1) var(--space-2-5)",
                borderRadius: "var(--radius-xs)",
                fontSize: "var(--font-size-11, 11px)",
                fontWeight: active ? 600 : 500,
                color: active ? "var(--text)" : "var(--text-faint)",
                background: active ? "var(--surface-2)" : "transparent",
                border: "none",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {seg.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
