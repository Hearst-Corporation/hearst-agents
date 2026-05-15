/**
 * /settings/alerting — Page configuration des alertes Hearst OS.
 */

import { PageHeader } from "@/app/(user-legacy)/components/PageHeader";
import { AlertingSettings } from "@/app/(user-legacy)/components/settings/AlertingSettings";

export default function AlertingSettingsPage() {
  return (
    <div
      className="flex-1 flex flex-col min-h-0 overflow-y-auto panel-enter"
      style={{ background: "var(--bg-elev)" }}
    >
      <PageHeader
        title="Alerting"
        subtitle="Canaux de notification pour les signaux critiques de Hearst OS."
        breadcrumb={[
          { label: "Hearst", href: "/" },
          { label: "Réglages", href: "/settings" },
          { label: "Alerting" },
        ]}
      />
      <div
        className="w-full px-12 py-6"
        style={{ maxWidth: "var(--width-center-max)", margin: "0 auto" }}
      >
        <AlertingSettings />
      </div>
    </div>
  );
}
