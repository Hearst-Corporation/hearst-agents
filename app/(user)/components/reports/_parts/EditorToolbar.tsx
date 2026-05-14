"use client";

type SaveStatus = "idle" | "form" | "saved" | "error";
type LoadStatus = "idle" | "loading_list" | "list" | "loading_spec" | "error";

interface EditorToolbarProps {
  jsonOpen: boolean;
  onToggleJson: () => void;
  onReset: () => void;
  saveStatus: SaveStatus;
  loadStatus: LoadStatus;
  onOpenSaveForm: () => void;
  onOpenLoadList: () => void;
}

export function EditorToolbar({
  jsonOpen,
  onToggleJson,
  onReset,
  saveStatus,
  loadStatus,
  onOpenSaveForm,
  onOpenLoadList,
}: EditorToolbarProps) {
  return (
    <div
      className="flex items-center flex-wrap"
      style={{ gap: "var(--space-2)" }}
    >
      <button
        type="button"
        onClick={onReset}
        data-testid="report-editor-reset"
        className="t-9 font-mono uppercase text-text-muted hover:text-text-soft"
        style={{
          padding: "var(--space-2) var(--space-3)",
          border: "1px solid var(--surface-2)",
          borderRadius: "var(--radius-xs)",
          background: "transparent",
          transition: "color var(--duration-fast) var(--ease-standard)",
        }}
      >
        Reset
      </button>
      <button
        type="button"
        onClick={onToggleJson}
        data-testid="report-editor-json-toggle"
        aria-expanded={jsonOpen}
        className="t-9 font-mono uppercase text-text-muted hover:text-text-soft"
        style={{
          padding: "var(--space-2) var(--space-3)",
          border: "1px solid var(--surface-2)",
          borderRadius: "var(--radius-xs)",
          background: "transparent",
          transition: "color var(--duration-fast) var(--ease-standard)",
        }}
      >
        {jsonOpen ? "Masquer JSON" : "Voir JSON"}
      </button>

      {/* Sauvegarder comme template */}
      {saveStatus === "idle" && (
        <button
          type="button"
          onClick={onOpenSaveForm}
          data-testid="report-editor-save-template"
          className="t-9 font-mono uppercase text-(--accent-teal) hover:text-text-soft"
          style={{
            padding: "var(--space-2) var(--space-3)",
            border: "1px solid var(--accent-teal)",
            borderRadius: "var(--radius-xs)",
            background: "transparent",
            transition: "color var(--duration-fast) var(--ease-standard)",
          }}
        >
          Sauvegarder template
        </button>
      )}
      {saveStatus === "saved" && (
        <span
          data-testid="report-editor-save-feedback"
          className="t-9 font-mono uppercase text-(--accent-teal)"
        >
          Template sauvegardé
        </span>
      )}
      {saveStatus === "error" && (
        <span
          data-testid="report-editor-save-feedback"
          className="t-9 font-mono uppercase"
          style={{ color: "var(--red)" }}
        >
          Erreur sauvegarde
        </span>
      )}

      {/* Charger un template */}
      {loadStatus === "idle" && (
        <button
          type="button"
          onClick={onOpenLoadList}
          data-testid="report-editor-load-template"
          className="t-9 font-mono uppercase text-text-muted hover:text-text-soft"
          style={{
            padding: "var(--space-2) var(--space-3)",
            border: "1px solid var(--surface-2)",
            borderRadius: "var(--radius-xs)",
            background: "transparent",
            transition: "color var(--duration-fast) var(--ease-standard)",
          }}
        >
          Charger template
        </button>
      )}
      {(loadStatus === "loading_list" || loadStatus === "loading_spec") && (
        <span className="t-9 font-mono uppercase text-text-faint">
          Chargement…
        </span>
      )}
      {loadStatus === "error" && (
        <span
          data-testid="report-editor-load-feedback"
          className="t-9 font-mono uppercase"
          style={{ color: "var(--red)" }}
        >
          Erreur chargement
        </span>
      )}
    </div>
  );
}
