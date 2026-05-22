"use client";

import { Action } from "@/app/(user)/components/ui";

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
    <div className="flex items-center flex-wrap" style={{ gap: "var(--space-2)" }}>
      <Action
        variant="secondary"
        tone="neutral"
        size="sm"
        onClick={onReset}
        testId="report-editor-reset"
      >
        Reset
      </Action>
      <Action
        variant="secondary"
        tone="neutral"
        size="sm"
        onClick={onToggleJson}
        aria-expanded={jsonOpen}
        testId="report-editor-json-toggle"
      >
        {jsonOpen ? "Masquer JSON" : "Voir JSON"}
      </Action>

      {/* Sauvegarder comme template */}
      {saveStatus === "idle" && (
        <Action
          variant="secondary"
          tone="brand"
          size="sm"
          onClick={onOpenSaveForm}
          testId="report-editor-save-template"
        >
          Sauvegarder template
        </Action>
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
        <Action
          variant="secondary"
          tone="neutral"
          size="sm"
          onClick={onOpenLoadList}
          testId="report-editor-load-template"
        >
          Charger template
        </Action>
      )}
      {(loadStatus === "loading_list" || loadStatus === "loading_spec") && (
        <span className="t-9 font-mono uppercase text-text-faint">Chargement…</span>
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
