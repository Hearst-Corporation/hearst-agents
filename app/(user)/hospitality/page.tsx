"use client";

import { StandalonePageFrame } from "@/app/(user)/components/standalone/StandalonePageFrame";
import { Action, PanelCard, ScreenShell, SectionEyebrow } from "@/app/(user)/components/ui";

// Aucun endpoint hospitality/PMS n'existe à ce jour.
// pmsConnected reste false jusqu'à l'implémentation d'un connecteur réel.
const pmsConnected = false;

export default function HospitalityPage() {
  return (
    <StandalonePageFrame>
      <ScreenShell
        title="Hospitality"
        subtitle="Cockpit vertical hôtellerie"
        back={{ label: "Cockpit", href: "/" }}
        empty={
          !pmsConnected
            ? {
                title: "Connectez un PMS",
                description:
                  "Aucun connecteur PMS configuré. Configurez Mews, Cloudbeds ou Opera pour afficher les indicateurs.",
                cta: { label: "Configurer un PMS", href: "/settings/connections" },
              }
            : false
        }
      >
        {pmsConnected && (
          <div style={{ maxWidth: "var(--width-center-max)" }}>
            <SectionEyebrow id="kpi">Indicateurs clés</SectionEyebrow>
            <PanelCard className="flex items-center justify-center text-center" padding="lg">
              <div>
                <p className="t-13 font-medium text-text-muted">Aucune donnée</p>
                <p
                  className="t-11 font-light text-text-faint max-w-(--width-xs) mx-auto"
                  style={{ marginTop: "var(--space-1)" }}
                >
                  Connectez un PMS pour afficher RevPAR, taux d&apos;occupation et satisfaction
                  client.
                </p>
              </div>
            </PanelCard>

            <div style={{ marginTop: "var(--space-10)" }}>
              <SectionEyebrow id="persona">Persona</SectionEyebrow>
              <PanelCard padding="lg">
                <div
                  className="flex flex-col lg:flex-row lg:items-center justify-between"
                  style={{ gap: "var(--space-6)" }}
                >
                  <div>
                    <p className="t-15 font-medium text-text">Concierge IA</p>
                    <p
                      className="t-11 font-medium text-text-faint"
                      style={{ marginTop: "var(--space-0-5)" }}
                    >
                      Spécialisé hôtellerie
                    </p>
                    <p
                      className="t-13 font-light text-text-muted leading-relaxed max-w-(--width-lg)"
                      style={{ marginTop: "var(--space-2)" }}
                    >
                      Agent conversationnel entraîné sur les données hôtelières. Répond aux
                      questions sur les tarifs, disponibilités et packages.
                    </p>
                  </div>
                  <Action variant="secondary" tone="neutral" size="md" disabled>
                    Bientôt disponible
                  </Action>
                </div>
              </PanelCard>
            </div>
          </div>
        )}
      </ScreenShell>
    </StandalonePageFrame>
  );
}
