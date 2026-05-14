"use client";

interface ModeToggleProps {
  batchMode: boolean;
  isBatchBusy: boolean;
  batchDone: boolean;
  isSingleBusy: boolean;
  singleDone: boolean;
  onSetSingle: () => void;
  onSetBatch: () => void;
}

export function ModeToggle({
  batchMode,
  isBatchBusy,
  batchDone,
  isSingleBusy,
  singleDone,
  onSetSingle,
  onSetBatch,
}: ModeToggleProps) {
  return (
    <div
      className="flex"
      style={{
        padding: "var(--space-3) var(--space-6)",
        borderBottom: "1px solid var(--border-shell)",
        gap: "var(--space-2)",
      }}
    >
      <button
        type="button"
        onClick={onSetSingle}
        disabled={isBatchBusy || batchDone}
        className={`t-11 font-light transition-colors duration-base disabled:opacity-50 ${
          !batchMode
            ? "border border-(--accent-teal) text-(--accent-teal) bg-[var(--accent-teal-surface)]"
            : "border border-(--border-shell) text-text-muted hover:text-text"
        }`}
        style={{
          flex: 1,
          padding: "var(--space-2) var(--space-3)",
          borderRadius: "var(--radius-sm)",
        }}
      >
        1 variant
      </button>
      <button
        type="button"
        onClick={onSetBatch}
        disabled={isSingleBusy || singleDone}
        className={`t-11 font-light transition-colors duration-base disabled:opacity-50 ${
          batchMode
            ? "border border-(--accent-teal) text-(--accent-teal) bg-[var(--accent-teal-surface)]"
            : "border border-(--border-shell) text-text-muted hover:text-text"
        }`}
        style={{
          flex: 1,
          padding: "var(--space-2) var(--space-3)",
          borderRadius: "var(--radius-sm)",
        }}
      >
        Mode batch
      </button>
    </div>
  );
}
