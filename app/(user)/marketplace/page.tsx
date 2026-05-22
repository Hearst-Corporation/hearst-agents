"use client";

import { useEffect, useState } from "react";
import { StandalonePageFrame } from "@/app/(user)/components/standalone/StandalonePageFrame";
import {
  Action,
  FilterTabs,
  PanelCard,
  ScreenShell,
  SearchField,
  StageErrorBanner,
} from "@/app/(user)/components/ui";

type KindLabel = "workflow" | "rapport" | "persona";

interface Template {
  id: number;
  title: string;
  description: string;
  author: string;
  uses: number;
  kind: KindLabel;
}

const KIND_STYLES: Record<KindLabel, { badge: string; label: string }> = {
  workflow: {
    badge: "bg-(--color-info)/10 text-(--color-info) border border-(--color-info)/25",
    label: "Workflow",
  },
  rapport: {
    badge: "bg-(--accent-llm)/10 text-(--accent-llm) border border-(--accent-llm)/25",
    label: "Rapport",
  },
  persona: {
    badge: "bg-(--accent-teal-surface) text-(--accent-teal) border border-(--accent-teal-border)",
    label: "Persona",
  },
};

const FILTERS = ["Tout", "Workflow", "Rapport", "Persona"] as const;
type Filter = (typeof FILTERS)[number];

// Map label de filtre → valeur kind
const FILTER_TO_KIND: Partial<Record<Filter, KindLabel>> = {
  Workflow: "workflow",
  Rapport: "rapport",
  Persona: "persona",
};

function useTemplates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        setLoading(true);
        setError(null);
        // Mock async — endpoint peut être créé ultérieurement
        await new Promise((r) => setTimeout(r, 600));
        const mockTemplates: Template[] = [
          {
            id: 1,
            title: "Brief Rédactionnel Hebdo",
            description: "Génère le planning éditorial de la semaine depuis les trends.",
            author: "equipe-hearst",
            uses: 482,
            kind: "workflow",
          },
          {
            id: 2,
            title: "Rapport Performance Édition",
            description: "Consolide les KPIs d'une édition : vues, taux de rebond, RPM.",
            author: "analytics-lab",
            uses: 317,
            kind: "rapport",
          },
          {
            id: 3,
            title: "Persona Directeur Hôtel",
            description: "Agent spécialisé RevPAR, OCC, satisfaction client hôtellerie.",
            author: "hospitality-hub",
            uses: 204,
            kind: "persona",
          },
          {
            id: 4,
            title: "Veille Concurrents Médias",
            description: "Scrape et synthétise les publications concurrentes chaque matin.",
            author: "equipe-hearst",
            uses: 391,
            kind: "workflow",
          },
          {
            id: 5,
            title: "Rapport Audience Mensuel",
            description: "Tableau de bord audience : acquisition, rétention, géo.",
            author: "data-studio",
            uses: 158,
            kind: "rapport",
          },
          {
            id: 6,
            title: "Persona Journaliste Enquête",
            description: "Assiste la rédaction longue : vérification sources, angles narratifs.",
            author: "newsroom-ai",
            uses: 276,
            kind: "persona",
          },
        ];
        setTemplates(mockTemplates);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur inconnue");
        setTemplates([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTemplates();
  }, []);

  return { templates, loading, error };
}

export default function MarketplacePage() {
  const [activeFilter, setActiveFilter] = useState<Filter>("Tout");
  const { templates, loading, error } = useTemplates();

  const filteredTemplates =
    activeFilter === "Tout"
      ? templates
      : templates.filter((t) => t.kind === FILTER_TO_KIND[activeFilter]);

  return (
    <StandalonePageFrame>
      <ScreenShell
        title="Marketplace"
        subtitle="Templates communautaires · workflows, rapports, personas"
        back={{ label: "Cockpit", href: "/" }}
        loading={loading}
        loadingVariant="cards"
        empty={
          !loading && templates.length === 0 && !error
            ? {
                title: "Aucun template",
                description: "La communauté partage ses templates ici.",
              }
            : false
        }
      >
        {error && <StageErrorBanner message={error} />}

        {!error && (
          <>
            <div
              className="flex flex-col sm:flex-row sm:items-center"
              style={{ gap: "var(--space-3)", marginBottom: "var(--space-6)" }}
            >
              <SearchField placeholder="Rechercher un template…" className="flex-1" />
              <FilterTabs
                tabs={FILTERS}
                active={activeFilter}
                aria-label="Filtrer par type"
                inline
                onValueChange={(v) => setActiveFilter(v as Filter)}
              />
            </div>

            <div
              className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
              style={{ gap: "var(--space-4)", maxWidth: "var(--width-center-max)" }}
            >
              {filteredTemplates.map((t) => {
                const { badge, label } = KIND_STYLES[t.kind];
                return (
                  <PanelCard key={t.id} hover className="flex flex-col gap-3">
                    <span
                      className={`t-9 font-medium rounded-pill inline-flex w-fit ${badge}`}
                      style={{ padding: "var(--space-1) var(--space-2-5)" }}
                    >
                      {label}
                    </span>
                    <div>
                      <p className="t-13 font-medium text-text leading-snug">{t.title}</p>
                      <p
                        className="t-11 font-light text-text-faint line-clamp-2"
                        style={{ marginTop: "var(--space-1)" }}
                      >
                        {t.description}
                      </p>
                    </div>
                    <div className="flex items-center justify-between mt-auto pt-1">
                      <p className="t-11 font-light text-text-ghost">
                        <span className="text-text-muted">{t.author}</span>
                        <span style={{ margin: "0 var(--space-1-5)" }}>·</span>
                        {t.uses.toLocaleString("fr-FR")} utilisations
                      </p>
                      <Action
                        variant="secondary"
                        tone="neutral"
                        size="sm"
                        aria-label={`Installer ${t.title}`}
                      >
                        Installer
                      </Action>
                    </div>
                  </PanelCard>
                );
              })}
            </div>
          </>
        )}
      </ScreenShell>
    </StandalonePageFrame>
  );
}
