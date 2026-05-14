"use client";

import { MAX_BATCH_VARIANTS } from "../types";

interface PanelHeaderProps {
  batchMode: boolean;
  onClose: () => void;
}

export function PanelHeader({ batchMode, onClose }: PanelHeaderProps) {
  return (
    <header
      className="flex items-center justify-between"
      style={{
        padding: "var(--space-6)",
        borderBottom: "1px solid var(--border-shell)",
      }}
    >
      <div className="flex flex-col gap-1">
        <span className="t-15 font-medium text-text">
          {batchMode ? "Vidéo · batch" : "Vidéo rapide"}
        </span>
        <span className="t-11 font-light text-text-muted">
          {batchMode
            ? `Jusqu'à ${MAX_BATCH_VARIANTS} variants en parallèle`
            : "⌘G — prompt + provider + go"}
        </span>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Fermer"
        className="t-13 font-light text-text-muted hover:text-text transition-colors duration-base"
        style={{ padding: "var(--space-1) var(--space-2)" }}
      >
        ESC
      </button>
    </header>
  );
}
