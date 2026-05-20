"use client";

/**
 * En-tête de la page Alerting : titre, sous-titre, statut de sauvegarde + bouton Enregistrer.
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
    <div className="flex items-center justify-between gap-4">
      <div>
        <h2
          className="t-15"
          style={{ color: "var(--text)", letterSpacing: "var(--tracking-tight)" }}
        >
          Alerting
        </h2>
        <p className="t-13" style={{ color: "var(--text-muted)", marginTop: "var(--space-1)" }}>
          Configurez les canaux de notification pour les signaux critiques.
        </p>
      </div>
      <div className="flex items-center gap-3">
        {saveStatus === "saved" && (
          <span
            className="t-9"
            style={{ color: "var(--color-success)", letterSpacing: "var(--tracking-caption)" }}
          >
            Enregistré
          </span>
        )}
        {saveStatus === "error" && (
          <span
            className="t-9"
            style={{ color: "var(--color-error-text)", letterSpacing: "var(--tracking-caption)" }}
          >
            {saveError ?? "Erreur"}
          </span>
        )}
        <Btn variant="primary" onClick={onSave} disabled={saveStatus === "saving"}>
          {saveStatus === "saving" ? "Enregistrement…" : "Enregistrer"}
        </Btn>
      </div>
    </div>
  );
}
