"use client";

import { Action } from "@/app/(user)/components/ui";

interface EditorHeaderProps {
  visibleCount: number;
  totalCount: number;
  onClose?: () => void;
}

export function EditorHeader({ visibleCount, totalCount, onClose }: EditorHeaderProps) {
  return (
    <header
      className="flex items-center justify-between"
      style={{
        paddingBottom: "var(--space-3)",
        borderBottom: "1px solid var(--surface-2)",
      }}
    >
      <div className="flex flex-col" style={{ gap: "var(--space-1)" }}>
        <span className="t-13 font-medium text-text-l1">Éditeur</span>
        <span className="t-13 text-text tabular-nums">
          {visibleCount} / {totalCount} blocs visibles
        </span>
      </div>
      {onClose && (
        <Action
          variant="ghost"
          tone="neutral"
          size="sm"
          onClick={onClose}
          aria-label="Fermer l'éditeur"
          testId="report-editor-close"
        >
          Fermer
        </Action>
      )}
    </header>
  );
}
