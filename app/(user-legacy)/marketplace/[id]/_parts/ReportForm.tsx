"use client";

interface ReportFormProps {
  reason: string;
  busy: boolean;
  onChangeReason: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function ReportForm({ reason, busy, onChangeReason, onSubmit, onCancel }: ReportFormProps) {
  return (
    <section
      className="flex flex-col gap-3 p-4 bg-bg-elev"
      style={{
        border: "1px solid var(--line-strong)",
        borderRadius: "var(--radius-md)",
      }}
    >
      <h3 className="t-13 text-text">Signaler ce template</h3>
      <textarea
        value={reason}
        onChange={(e) => onChangeReason(e.target.value)}
        rows={3}
        placeholder="Raison (3-500 caractères)…"
        maxLength={500}
        className="block w-full bg-transparent t-13 text-text focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-teal-border-hover)] resize-none"
        style={{
          padding: "var(--space-2) var(--space-3)",
          border: "1px solid var(--line-strong)",
          borderRadius: "var(--radius-sm)",
          background: "var(--surface-1)",
        }}
      />
      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="t-11 font-light text-text-faint"
          style={{ background: "transparent", border: "none", cursor: "pointer" }}
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={busy || reason.trim().length < 3}
          className="t-11 font-medium text-text"
          style={{
            padding: "var(--space-2) var(--space-4)",
            background: "var(--danger)",
            border: "1px solid var(--danger)",
            borderRadius: "var(--radius-sm)",
            cursor: busy ? "not-allowed" : "pointer",
            opacity: busy ? 0.6 : 1,
          }}
        >
          Envoyer
        </button>
      </div>
    </section>
  );
}
