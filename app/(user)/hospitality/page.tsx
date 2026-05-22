"use client";

import { useEffect, useState } from "react";
import { StandalonePageFrame } from "@/app/(user)/components/standalone/StandalonePageFrame";
import { Action, PanelCard, ScreenShell, SectionEyebrow } from "@/app/(user)/components/ui";

interface WorkflowCard {
  id: string;
  title: string;
  description: string;
}

function useHospitalityData() {
  const [workflows, setWorkflows] = useState<WorkflowCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [pmsConnected, setPmsConnected] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Mock async — simule l'absence de connecteur PMS
        await new Promise((r) => setTimeout(r, 400));
        const mockWorkflows: WorkflowCard[] = [
          {
            id: "checkin",
            title: "Check-in automatisé",
            description:
              "Envoie automatiquement les instructions d'arrivée 24h avant, adapte le message selon le profil.",
          },
          {
            id: "nuit",
            title: "Rapport nuit mensuel",
            description:
              "Consolide les données nuitées, incidents et taux d'occupation en un rapport PDF envoyé le 1er du mois.",
          },
        ];
        setWorkflows(mockWorkflows);
        setPmsConnected(false);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return { workflows, loading, pmsConnected };
}

export default function HospitalityPage() {
  const { workflows, loading, pmsConnected } = useHospitalityData();

  return (
    <StandalonePageFrame>
      <ScreenShell
        title="Hospitality"
        subtitle="Cockpit vertical hôtellerie"
        back={{ label: "Cockpit", href: "/" }}
        loading={loading}
        loadingVariant="rows"
        empty={
          !loading && !pmsConnected
            ? {
                title: "Connectez un PMS",
                description:
                  "Aucun connecteur PMS configuré. Configurez Mews, Cloudbeds ou Opera pour afficher les indicateurs.",
                cta: { label: "Configurer un PMS", href: "/settings/connections" },
              }
            : false
        }
      >
        {!loading && !pmsConnected && (
          <div style={{ marginBottom: "var(--space-8)", maxWidth: "var(--width-center-max)" }}>
            <PanelCard className="t-13 font-light text-text-muted">
              Les indicateurs s&apos;afficheront une fois un PMS (Mews / Cloudbeds / Opera)
              connecté.
            </PanelCard>
          </div>
        )}

        {!loading && pmsConnected && (
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
          </div>
        )}

        {!loading && (
          <div style={{ maxWidth: "var(--width-center-max)" }}>
            <SectionEyebrow id="workflows">Workflows</SectionEyebrow>
            <div className="flex flex-col" style={{ gap: "var(--space-3)" }}>
              {workflows.map((w) => (
                <PanelCard key={w.id} className="flex items-center gap-5">
                  <div className="flex-1 min-w-0">
                    <p className="t-13 font-medium text-text">{w.title}</p>
                    <p
                      className="t-11 font-light text-text-faint leading-relaxed"
                      style={{ marginTop: "var(--space-0-5)" }}
                    >
                      {w.description}
                    </p>
                  </div>
                  <Action
                    variant="secondary"
                    tone="neutral"
                    size="sm"
                    disabled
                    aria-label="Bientôt disponible — nécessite un connecteur PMS"
                  >
                    Bientôt disponible
                  </Action>
                </PanelCard>
              ))}
            </div>

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
