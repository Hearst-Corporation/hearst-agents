"use client";

import { AlertingSettings } from "@/app/(user)/components/settings/alerting/AlertingSettings";
import { StandalonePageFrame } from "@/app/(user)/components/standalone/StandalonePageFrame";
import { ScreenShell } from "@/app/(user)/components/ui";

export default function AlertingPage() {
  return (
    <StandalonePageFrame>
      <ScreenShell
        title="Alerting"
        subtitle="Seuils · Canaux · Règles"
        back={{ label: "Réglages", href: "/settings" }}
      >
        <AlertingSettings />
      </ScreenShell>
    </StandalonePageFrame>
  );
}
