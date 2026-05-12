"use client";

import { useSpatialPanelsStore } from "@/stores/spatial-panels";
import type { SpatialPanelType } from "@/lib/spatial/panel-types";

interface DockItem {
  type: SpatialPanelType;
  label: string;
}

const DOCK_ITEMS: DockItem[] = [
  { type: "brief", label: "Brief" },
  { type: "mission", label: "Mission" },
  { type: "assets", label: "Assets" },
];

const FOCUSABLE_PANEL_TYPES: SpatialPanelType[] = [
  "brief",
  "mission",
  "assets",
  "chat-response",
  "asset-preview",
  "kpi",
  "kpi-pulse",
  "memory-recall",
  "notification",
  "meeting-intel",
];

export function SpatialPanelDock() {
  const panels = useSpatialPanelsStore((s) => s.panels);
  const open = useSpatialPanelsStore((s) => s.open);
  const closeByType = useSpatialPanelsStore((s) => s.closeByType);
  const focusMode = !panels.some((panel) => FOCUSABLE_PANEL_TYPES.includes(panel.type));

  function togglePanel(type: SpatialPanelType) {
    const isOpen = panels.some((panel) => panel.type === type);
    if (isOpen) {
      closeByType(type);
      return;
    }
    for (const item of DOCK_ITEMS) {
      if (item.type !== type) closeByType(item.type);
    }
    open(type);
  }

  function enterFocusMode() {
    for (const type of FOCUSABLE_PANEL_TYPES) {
      closeByType(type);
    }
  }

  return (
    <nav
      aria-label="Navigation spatiale"
      className="pointer-events-none absolute left-7 top-1/2 -translate-y-1/2"
      style={{ zIndex: 52 }}
    >
      <div
        className="pointer-events-auto flex flex-col items-stretch gap-1 rounded-2xl p-2 animate-[fade-in-slide-up-subtle_0.6s_ease-out]"
        style={{
          background: "var(--bg-panel-gradient)",
          backdropFilter: "blur(var(--blur-lg))",
          WebkitBackdropFilter: "blur(var(--blur-lg))",
          border: "1px solid var(--border-strong)",
          boxShadow: "var(--shadow-panel-lift)",
        }}
      >
        <button
          type="button"
          aria-pressed={focusMode}
          onClick={enterFocusMode}
          className={`group flex min-w-[96px] items-center gap-2.5 rounded-xl px-3 py-2.5 text-left t-13 font-light tracking-wide transition-all duration-300 ease-in-out
            ${focusMode ? "text-text-l0 bg-surface-2 shadow-sm" : "text-text-l2"}
            hover:text-text-l0 hover:bg-surface-1 hover:shadow-md
          `}
          style={{}}
        >
          <span
            aria-hidden
            className={`h-1.5 w-1.5 rounded-full transition-all duration-300 ease-in-out
              ${focusMode ? "bg-accent-teal shadow-pulse-dot-md" : "bg-text-l3"}
            `}
            style={{}}
          />
          Focus
        </button>
        {DOCK_ITEMS.map((item) => {
          const active = panels.some((panel) => panel.type === item.type);
          return (
            <button
              key={item.type}
              type="button"
              aria-pressed={active}
              onClick={() => togglePanel(item.type)}
              className={`group flex min-w-[96px] items-center gap-2.5 rounded-xl px-3 py-2.5 text-left t-13 font-light tracking-wide transition-all duration-300 ease-in-out
                ${active ? "text-text-l0 bg-surface-2 shadow-sm" : "text-text-l2"}
                hover:text-text-l0 hover:bg-surface-1 hover:shadow-md
              `}
              style={{}}
            >
              <span
                aria-hidden
                className={`h-1.5 w-1.5 rounded-full transition-all duration-300 ease-in-out
                  ${active ? "bg-accent-teal shadow-pulse-dot-md" : "bg-text-l3"}
                `}
                style={{}}
              />
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
