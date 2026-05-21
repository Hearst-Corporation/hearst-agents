"use client";

/**
 * BottomBar — barre de navigation par onglets en bas du cockpit.
 *
 * Segments : Overview / Search / Graph / Projects / Patterns / Ingest / Connectors / Admin / Cost
 */

import { useCallback } from "react";
import { useStageStore } from "@/stores/stage";

const SEGMENTS = [
  { id: "overview", label: "Overview", mode: "cockpit" as const },
  { id: "search", label: "Search", mode: "cockpit" as const },
  { id: "graph", label: "Graph", mode: "kg" as const },
  { id: "projects", label: "Projects", mode: "mission" as const },
  { id: "patterns", label: "Patterns", mode: "signal" as const },
  { id: "ingest", label: "Ingest", mode: "cockpit" as const },
  { id: "connectors", label: "Connectors", mode: "connections" as const },
  { id: "admin", label: "Admin", mode: "cockpit" as const },
  { id: "cost", label: "Cost", mode: "cockpit" as const },
];

export function BottomBar() {
  const currentMode = useStageStore((s) => s.current.mode);
  const setMode = useStageStore((s) => s.setMode);

  const isActive = useCallback(
    (seg: (typeof SEGMENTS)[number]) => {
      if (seg.id === "overview") return currentMode === "cockpit";
      return currentMode === seg.mode;
    },
    [currentMode],
  );

  return (
    <div
      className="ct-bottom-bar"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-1)",
        padding: "var(--space-3) var(--space-4)",
        marginTop: "var(--space-4)",
        borderTop: "1px solid var(--border-shell)",
      }}
    >
      {SEGMENTS.map((seg) => {
        const active = isActive(seg);
        return (
          <button
            key={seg.id}
            type="button"
            onClick={() => {
              if (seg.mode === "cockpit" && seg.id === "overview") {
                setMode({ mode: "cockpit" });
              } else if (seg.mode !== "cockpit") {
                setMode({ mode: seg.mode });
              }
            }}
            style={{
              padding: "var(--space-1-5) var(--space-3)",
              borderRadius: "var(--radius-sm)",
              fontSize: "var(--font-size-11, 11px)",
              fontWeight: active ? 600 : 500,
              letterSpacing: "0.04em",
              color: active ? "var(--accent-teal)" : "var(--text-faint)",
              background: active ? "var(--accent-teal-surface)" : "transparent",
              border: "none",
              cursor: "pointer",
              transition: "all 0.15s ease",
              whiteSpace: "nowrap",
            }}
            onMouseEnter={(e) => {
              if (!active) {
                e.currentTarget.style.color = "var(--text-muted)";
                e.currentTarget.style.background = "var(--surface-1)";
              }
            }}
            onMouseLeave={(e) => {
              if (!active) {
                e.currentTarget.style.color = "var(--text-faint)";
                e.currentTarget.style.background = "transparent";
              }
            }}
          >
            {seg.label}
          </button>
        );
      })}
    </div>
  );
}
