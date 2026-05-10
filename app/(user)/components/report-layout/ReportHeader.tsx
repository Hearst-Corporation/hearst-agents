/**
 * ReportHeader — barre d'actions au-dessus de la grille du report.
 *
 * Contient : actions Export/Partager/Commenter (`<ReportActions />` si
 * `assetId` fourni en mode read-write), toggle "Historique" et toggle
 * "Éditer". Les toggles sont mutuellement exclusifs (ouvrir l'un ferme
 * l'autre côté parent — voir orchestrateur).
 */

import type { JSX } from "react";
import { ReportActions } from "@/app/(user)/components/ReportActions";

interface ReportHeaderProps {
  assetId?: string | null;
  assetTitle?: string;
  readonly: boolean;
  editable: boolean;
  editorOpen: boolean;
  historyOpen: boolean;
  onToggleEditor: () => void;
  onToggleHistory: () => void;
}

export function ReportHeader({
  assetId,
  assetTitle,
  readonly,
  editable,
  editorOpen,
  historyOpen,
  onToggleEditor,
  onToggleHistory,
}: ReportHeaderProps): JSX.Element | null {
  const showActions = Boolean(assetId) && !readonly;
  if (!editable && !showActions) return null;

  return (
    <div
      className="flex items-center justify-end"
      style={{ marginBottom: "var(--space-3)", gap: "var(--space-2)" }}
    >
      {showActions && assetId && (
        <ReportActions reportId={assetId} title={assetTitle} />
      )}
      {showActions && (
        <button
          type="button"
          onClick={onToggleHistory}
          data-testid="report-layout-history-toggle"
          aria-expanded={historyOpen}
          className="t-11 font-medium text-text-muted hover:text-(--accent-teal)"
          style={{
            padding: "var(--space-2) var(--space-3)",
            border: "1px solid var(--surface-2)",
            borderRadius: "var(--radius-xs)",
            background: "transparent",
            transition: "color var(--duration-fast) var(--ease-standard)",
          }}
        >
          {historyOpen ? "Fermer" : "Historique"}
        </button>
      )}
      {editable && (
        <button
          type="button"
          onClick={onToggleEditor}
          data-testid="report-layout-edit-toggle"
          aria-expanded={editorOpen}
          className="t-11 font-medium text-text-muted hover:text-(--accent-teal)"
          style={{
            padding: "var(--space-2) var(--space-3)",
            border: "1px solid var(--surface-2)",
            borderRadius: "var(--radius-xs)",
            background: "transparent",
            transition: "color var(--duration-fast) var(--ease-standard)",
          }}
        >
          {editorOpen ? "Fermer" : "Éditer"}
        </button>
      )}
    </div>
  );
}
