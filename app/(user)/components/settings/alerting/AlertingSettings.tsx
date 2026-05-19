"use client";

/**
 * AlertingSettings — Orchestrateur des canaux d'alerting (webhook, email, Slack).
 *
 * Sections :
 *  - Webhooks (liste + ajout + suppression + test)
 *  - Email (destinataires, signal types, toggle)
 *  - Slack (webhook URL, toggle, test)
 *  - Signal Types (référence)
 *
 * Tokens design system : globals.css (spacing, radius, colors, shadows, typo).
 * Aucun magic number CSS.
 */

import { Action } from "../../ui";
import { EmailSection } from "./EmailSection";
import { SaveHeader } from "./SaveHeader";
import { SignalTypesSection } from "./SignalTypesSection";
import { SlackSection } from "./SlackSection";
import { useAlertingPrefs } from "./useAlertingPrefs";
import { WebhooksSection } from "./WebhooksSection";

export function AlertingSettings() {
  const { state, dispatch, handleSave, testChannel, reloadPrefs } = useAlertingPrefs();

  if (state.loading) {
    return (
      <div className="flex items-center justify-center p-12" style={{ color: "var(--text-faint)" }}>
        <span className="t-13">Chargement des préférences…</span>
      </div>
    );
  }

  // Garde-fou data-loss : si le chargement initial a échoué, on bloque l'accès
  // aux sections et au bouton Enregistrer. Sinon le user verrait un formulaire
  // vide et pourrait sauvegarder `{}` par-dessus ses préférences existantes.
  if (state.loadError) {
    return (
      <div
        role="alert"
        className="flex flex-col items-start gap-4 p-6"
        style={{
          maxWidth: "var(--width-center-max)",
          background: "var(--surface-1)",
          border: "1px solid var(--border-danger, var(--border-default))",
          borderRadius: "var(--radius-md)",
          color: "var(--text)",
        }}
      >
        <h2 className="t-15 font-medium m-0">Impossible de charger tes préférences d'alerting</h2>
        <p
          className="t-13 m-0"
          style={{ color: "var(--text-soft)", lineHeight: "var(--leading-relaxed)" }}
        >
          {state.loadError}. Ne saisis pas de nouvelles préférences pour le moment — tu risquerais
          d'écraser ta configuration existante.
        </p>
        <Action variant="secondary" tone="neutral" onClick={() => void reloadPrefs()}>
          Réessayer
        </Action>
      </div>
    );
  }

  const { prefs } = state;

  return (
    <div className="flex flex-col gap-8 w-full" style={{ maxWidth: "var(--width-center-max)" }}>
      <SaveHeader
        saveStatus={state.saveStatus}
        saveError={state.saveError}
        onSave={() => handleSave(prefs)}
      />

      <WebhooksSection prefs={prefs} state={state} dispatch={dispatch} onTest={testChannel} />

      <EmailSection prefs={prefs} state={state} dispatch={dispatch} onTest={testChannel} />

      <SlackSection prefs={prefs} state={state} dispatch={dispatch} onTest={testChannel} />

      <SignalTypesSection />
    </div>
  );
}
