"use client";

/**
 * Primitives segmentées locales à VideoQuickLaunch.
 *
 * `SegmentedRow` : groupe de boutons toggle avec label au-dessus.
 *  Utilisé pour Durée / Provider / Ratio dans le mode simple.
 *
 * `SegmentedInline` : même chose, version compacte sans label, posée
 *  dans la card de chaque variant en mode batch.
 *
 * `ProgressBlock` : carte progress bar + label phase + erreur (mode simple).
 */

export function SegmentedRow<T extends string | number>({
  label,
  options,
  value,
  onChange,
  getLabel,
  disabled,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  getLabel: (v: T) => string;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col" style={{ gap: "var(--space-2)" }}>
      <span className="t-11 font-medium text-text-muted">{label}</span>
      <div className="flex" style={{ gap: "var(--space-2)" }}>
        {options.map((opt) => {
          const active = value === opt;
          return (
            <button
              key={String(opt)}
              type="button"
              onClick={() => onChange(opt)}
              disabled={disabled}
              className={`t-13 font-light transition-colors duration-base disabled:opacity-50 disabled:cursor-not-allowed ${
                active
                  ? "border border-(--accent-teal) text-(--accent-teal) bg-[var(--accent-teal-surface)]"
                  : "border border-(--border-shell) text-text-muted hover:text-text"
              }`}
              style={{
                flex: 1,
                padding: "var(--space-2) var(--space-3)",
                borderRadius: "var(--radius-sm)",
              }}
            >
              {getLabel(opt)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function SegmentedInline<T extends string | number>({
  options,
  value,
  onChange,
  getLabel,
  disabled,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  getLabel: (v: T) => string;
  disabled: boolean;
}) {
  return (
    <div className="flex" style={{ gap: "var(--space-1)", flex: 1 }}>
      {options.map((opt) => {
        const active = value === opt;
        return (
          <button
            key={String(opt)}
            type="button"
            onClick={() => onChange(opt)}
            disabled={disabled}
            className={`t-11 font-light transition-colors duration-base disabled:opacity-50 disabled:cursor-not-allowed ${
              active
                ? "border border-(--accent-teal) text-(--accent-teal) bg-[var(--accent-teal-surface)]"
                : "border border-(--border-shell) text-text-muted hover:text-text"
            }`}
            style={{
              flex: 1,
              padding: "var(--space-1) var(--space-2)",
              borderRadius: "var(--radius-xs)",
            }}
          >
            {getLabel(opt)}
          </button>
        );
      })}
    </div>
  );
}

export function ProgressBlock({
  phase,
  progress,
  label,
  errorMsg,
}: {
  phase: "queued" | "running" | "done" | "error";
  progress: number;
  label: string;
  errorMsg: string | null;
}) {
  return (
    <div
      className="flex flex-col"
      style={{
        gap: "var(--space-2)",
        padding: "var(--space-4)",
        background: "var(--card-flat-bg)",
        border: "1px solid var(--border-shell)",
        borderRadius: "var(--radius-sm)",
      }}
    >
      <div className="flex items-center justify-between">
        <span className="t-11 font-light text-text-muted">{label}</span>
        <span className="t-11 font-mono tabular-nums text-text-muted">
          {phase === "error" ? "—" : `${Math.round(progress)}%`}
        </span>
      </div>
      <div
        aria-hidden
        style={{
          height: "var(--space-1)",
          background: "var(--surface-1)",
          borderRadius: "var(--radius-pill)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${phase === "error" ? 0 : Math.max(progress, phase === "running" ? 4 : 0)}%`,
            background: phase === "error" ? "var(--danger)" : "var(--accent-teal)",
            transition: "width var(--duration-emphasis) var(--ease-out-soft)",
          }}
        />
      </div>
      {errorMsg && phase === "error" && (
        <p className="t-11 font-light text-(--danger)" style={{ marginTop: "var(--space-1)" }}>
          {errorMsg}
        </p>
      )}
    </div>
  );
}
