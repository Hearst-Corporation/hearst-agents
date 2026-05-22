"use client";

import { IconButton } from "@/app/(user)/components/ui";
import type { BlockSpec } from "@/lib/reports/spec/schema";

export interface BlockEditorRowProps {
  block: BlockSpec;
  index: number;
  total: number;
  onToggle: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export function BlockEditorRow({
  block,
  index,
  total,
  onToggle,
  onMoveUp,
  onMoveDown,
}: BlockEditorRowProps) {
  const isVisible = !block.hidden;
  const canMoveUp = index > 0;
  const canMoveDown = index < total - 1;
  const titleText = block.label ?? block.id;

  return (
    <li
      className="flex items-center"
      style={{
        gap: "var(--space-3)",
        padding: "var(--space-3)",
        background: isVisible ? "var(--surface-1)" : "transparent",
        border: "1px solid var(--surface-2)",
        borderRadius: "var(--radius-xs)",
      }}
    >
      <input
        type="checkbox"
        checked={isVisible}
        onChange={onToggle}
        aria-label={`Toggle visibilité ${block.id}`}
        data-testid={`report-editor-toggle-${block.id}`}
        style={{ accentColor: "var(--accent-teal)" }}
      />
      <div className="flex flex-col flex-1 min-w-0" style={{ gap: "var(--space-1)" }}>
        <span
          className={`t-11 truncate ${isVisible ? "text-text-soft" : "text-text-faint"}`}
          title={titleText}
        >
          {titleText}
        </span>
        <div className="flex items-center" style={{ gap: "var(--space-2)" }}>
          <span className="t-9 font-mono uppercase text-(--accent-teal)">{block.type}</span>
          <span className="t-9 font-mono uppercase text-text-faint">#{block.id}</span>
          <span className="t-9 font-mono uppercase text-text-faint">col_{block.layout.col}</span>
        </div>
      </div>
      <div className="flex items-center" style={{ gap: "var(--space-1)" }}>
        <IconButton
          icon="↑"
          label={`Remonter ${block.id}`}
          size="xs"
          tone="muted"
          onClick={onMoveUp}
          disabled={!canMoveUp}
          testId={`report-editor-up-${block.id}`}
        />
        <IconButton
          icon="↓"
          label={`Descendre ${block.id}`}
          size="xs"
          tone="muted"
          onClick={onMoveDown}
          disabled={!canMoveDown}
          testId={`report-editor-down-${block.id}`}
        />
      </div>
    </li>
  );
}
