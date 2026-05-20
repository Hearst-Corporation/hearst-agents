"use client";

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
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer l'éditeur"
          data-testid="report-editor-close"
          className="t-11 font-light text-text-muted hover:text-text-soft"
          style={{
            padding: "var(--space-1) var(--space-3)",
            border: "1px solid var(--surface-2)",
            borderRadius: "var(--radius-xs)",
            background: "transparent",
            transition: "color var(--duration-fast) var(--ease-standard)",
          }}
        >
          Fermer
        </button>
      )}
    </header>
  );
}
