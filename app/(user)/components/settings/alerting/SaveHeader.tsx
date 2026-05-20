"use client";

/**
 * Barre d'actions Alerting (statut + Enregistrer).
 * Titre / sous-titre : fournis par ScreenShell sur la route /settings/alerting.
 */

import { Btn } from "./primitives";
import type { SaveStatus } from "./types";

interface Props {
  saveStatus: SaveStatus;
  saveError: string | null;
  onSave: () => void;
}

export function SaveHeader({ saveStatus, saveError, onSave }: Props) {
  return (
    <div className="flex items-center justify-end gap-3 flex-wrap">
      {saveStatus === "saved" && (
        <span className="t-9 text-(--color-success) tracking-(--tracking-caption)">Enregistré</span>
      )}
      {saveStatus === "error" && (
        <span className="t-9 text-(--color-error) tracking-(--tracking-caption)">
          {saveError ?? "Erreur"}
        </span>
      )}
      <Btn variant="primary" onClick={onSave} disabled={saveStatus === "saving"}>
        {saveStatus === "saving" ? "Enregistrement…" : "Enregistrer"}
      </Btn>
    </div>
  );
}
