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
import { Action } from "@/app/(user)/components/ui";

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
      {showActions && assetId && <ReportActions reportId={assetId} title={assetTitle} />}
      {showActions && (
        <Action
          variant="secondary"
          tone="neutral"
          size="sm"
          onClick={onToggleHistory}
          testId="report-layout-history-toggle"
          aria-expanded={historyOpen}
        >
          {historyOpen ? "Fermer" : "Historique"}
        </Action>
      )}
      {editable && (
        <Action
          variant="secondary"
          tone="neutral"
          size="sm"
          onClick={onToggleEditor}
          testId="report-layout-edit-toggle"
          aria-expanded={editorOpen}
        >
          {editorOpen ? "Fermer" : "Éditer"}
        </Action>
      )}
    </div>
  );
}
