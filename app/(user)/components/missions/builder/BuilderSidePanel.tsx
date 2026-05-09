"use client";

import { useState } from "react";
import { NodePalette, type PaletteEntry } from "./NodePalette";
import { NodeConfigPanel } from "./NodeConfigPanel";
import type { WorkflowNode } from "@/lib/workflows/types";

type Tab = "palette" | "inspector";

interface BuilderSidePanelProps {
  selectedNode: WorkflowNode | null;
  onAdd: (entry: PaletteEntry) => void;
  onChange: (patch: Partial<WorkflowNode>) => void;
  onDelete: () => void;
}

export function BuilderSidePanel({
  selectedNode,
  onAdd,
  onChange,
  onDelete,
}: BuilderSidePanelProps) {
  const [tab, setTab] = useState<Tab>("palette");
  // Derived state pattern (React-recommended): track previous nodeId during render
  // to auto-switch tabs without a useEffect setState.
  const [prevNodeId, setPrevNodeId] = useState<string | null>(null);
  const nodeId = selectedNode?.id ?? null;
  if (prevNodeId !== nodeId) {
    setPrevNodeId(nodeId);
    setTab(nodeId ? "inspector" : "palette");
  }

  return (
    <div
      className="flex flex-col h-full min-h-0 overflow-hidden"
      style={{ background: "var(--rail)", borderLeft: "1px solid var(--border-shell)" }}
    >
      {/* Tab toggle */}
      <div
        className="flex items-center shrink-0"
        style={{
          padding: "var(--space-3) var(--space-4)",
          gap: "var(--space-1)",
          borderBottom: "1px solid var(--border-shell)",
        }}
      >
        {(["palette", "inspector"] as Tab[]).map((t) => {
          const isActive = tab === t;
          const label = t === "palette" ? "Palette" : "Inspecteur";
          const badge = t === "inspector" && selectedNode ? "·" : null;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className="t-11 font-medium transition-all rounded-md"
              style={{
                padding: "var(--space-1) var(--space-3)",
                background: isActive ? "var(--accent-teal-bg-active)" : "transparent",
                color: isActive ? "var(--accent-teal)" : "var(--text-muted)",
                border: `1px solid ${isActive ? "var(--accent-teal-border)" : "transparent"}`,
                transitionDuration: "var(--duration-base)",
              }}
            >
              {label}
              {badge && (
                <span
                  className="ml-1"
                  style={{ color: "var(--accent-teal)" }}
                >
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {tab === "palette" ? (
          <PaletteContent onAdd={onAdd} />
        ) : (
          <NodeConfigPanel
            node={selectedNode}
            onChange={onChange}
            onDelete={onDelete}
          />
        )}
      </div>
    </div>
  );
}

function PaletteContent({ onAdd }: { onAdd: (entry: PaletteEntry) => void }) {
  return (
    <div style={{ padding: "var(--space-4)" }}>
      <NodePalette onAdd={onAdd} />
    </div>
  );
}
