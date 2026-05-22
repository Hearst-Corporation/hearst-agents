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
import type { MarketplaceKind, MarketplaceTemplateSummary } from "@/lib/marketplace/types";

// Sous-ensemble des kinds affichés dans cette page
type DisplayKind = Extract<
  MarketplaceKind,
  "workflow" | "report_spec" | "persona" | "creative_prompt"
>;

const KIND_STYLES: Record<DisplayKind, { badge: string; label: string }> = {
  workflow: {
    badge: "bg-(--color-info)/10 text-(--color-info) border border-(--color-info)/25",
    label: "Workflow",
  },
  report_spec: {
    badge: "bg-(--accent-llm)/10 text-(--accent-llm) border border-(--accent-llm)/25",
    label: "Rapport",
  },
  persona: {
    badge: "bg-(--accent-teal-surface) text-(--accent-teal) border border-(--accent-teal-border)",
    label: "Persona",
  },
  creative_prompt: {
    badge: "bg-(--color-warning)/10 text-(--color-warning) border border-(--color-warning)/25",
    label: "Créatif",
  },
};

const FILTERS = ["Tout", "Workflow", "Rapport", "Persona", "Créatif"] as const;
type Filter = (typeof FILTERS)[number];

// Map label de filtre → valeur kind API
const FILTER_TO_KIND: Partial<Record<Filter, DisplayKind>> = {
  Workflow: "workflow",
  Rapport: "report_spec",
  Persona: "persona",
  Créatif: "creative_prompt",
};

function useTemplates() {
  const [templates, setTemplates] = useState<MarketplaceTemplateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/v2/marketplace/templates?limit=60");
        if (!res.ok) {
          throw new Error(`Erreur ${res.status} lors du chargement des templates`);
        }
        const data = (await res.json()) as { templates: MarketplaceTemplateSummary[] };
        setTemplates(data.templates ?? []);
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
                const kindStyle = KIND_STYLES[t.kind as DisplayKind] ?? KIND_STYLES.workflow;
                const { badge, label } = kindStyle;
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
                        {t.authorDisplayName && (
                          <>
                            <span className="text-text-muted">{t.authorDisplayName}</span>
                            <span style={{ margin: "0 var(--space-1-5)" }}>·</span>
                          </>
                        )}
                        {t.cloneCount.toLocaleString("fr-FR")} utilisations
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
