"use client";

import { AlertingSettings } from "@/app/(user)/components/settings/alerting/AlertingSettings";
import { useAlertingPrefs } from "@/app/(user)/components/settings/alerting/useAlertingPrefs";
import { StandalonePageFrame } from "@/app/(user)/components/standalone/StandalonePageFrame";
import { ScreenShell } from "@/app/(user)/components/ui";

export default function AlertingPage() {
  const { state } = useAlertingPrefs();

  return (
    <StandalonePageFrame>
      <ScreenShell
        title="Alerting"
        subtitle="Seuils · Canaux · Règles"
        back={{ label: "Réglages", href: "/settings" }}
        loading={state.loading}
      >
        <AlertingSettings />
      </ScreenShell>
    </StandalonePageFrame>
  );
}
