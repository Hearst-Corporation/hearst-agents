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

import { EmailSection } from "./EmailSection";
import { SaveHeader } from "./SaveHeader";
import { SignalTypesSection } from "./SignalTypesSection";
import { SlackSection } from "./SlackSection";
import { useAlertingPrefs } from "./useAlertingPrefs";
import { WebhooksSection } from "./WebhooksSection";

export function AlertingSettings() {
  const { state, dispatch, handleSave, testChannel } = useAlertingPrefs();

  if (state.loading) {
    return (
      <div className="flex items-center justify-center p-12" style={{ color: "var(--text-faint)" }}>
        <span className="t-13">Chargement des préférences…</span>
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
