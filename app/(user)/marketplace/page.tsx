"use client";

import { MarketplaceTemplateCard } from "@/app/(user)/components/marketplace/MarketplaceTemplateCard";
import { StandalonePageFrame } from "@/app/(user)/components/standalone/StandalonePageFrame";
import { FilterTabs, ScreenShell, SearchField } from "@/app/(user)/components/ui";
import type { MarketplaceTemplateSummary } from "@/lib/marketplace/types";

/** Données mock — en attente de branchement GET /api/v2/marketplace/templates. */
const MOCK_TEMPLATES: MarketplaceTemplateSummary[] = [
  {
    id: "mock-1",
    kind: "workflow",
    title: "Brief Rédactionnel Hebdo",
    description: "Génère le planning éditorial de la semaine depuis les trends.",
    authorDisplayName: "equipe-hearst",
    authorTenantId: "hearst-builtin",
    tags: ["editorial", "hebdo"],
    ratingAvg: 4.6,
    ratingCount: 48,
    cloneCount: 482,
    isFeatured: true,
    createdAt: "",
    updatedAt: "",
  },
  {
    id: "mock-2",
    kind: "report_spec",
    title: "Rapport Performance Édition",
    description: "Consolide les KPIs d'une édition : vues, taux de rebond, RPM.",
    authorDisplayName: "analytics-lab",
    authorTenantId: "hearst-builtin",
    tags: ["kpi", "edition"],
    ratingAvg: 4.2,
    ratingCount: 31,
    cloneCount: 317,
    isFeatured: false,
    createdAt: "",
    updatedAt: "",
  },
  {
    id: "mock-3",
    kind: "persona",
    title: "Persona Directeur Hôtel",
    description: "Agent spécialisé RevPAR, OCC, satisfaction client hôtellerie.",
    authorDisplayName: "hospitality-hub",
    authorTenantId: "hearst-builtin",
    tags: ["hospitality", "revpar"],
    ratingAvg: 4.8,
    ratingCount: 22,
    cloneCount: 204,
    isFeatured: false,
    createdAt: "",
    updatedAt: "",
  },
  {
    id: "mock-4",
    kind: "workflow",
    title: "Veille Concurrents Médias",
    description: "Scrape et synthétise les publications concurrentes chaque matin.",
    authorDisplayName: "equipe-hearst",
    authorTenantId: "hearst-builtin",
    tags: ["veille", "media"],
    ratingAvg: 4.4,
    ratingCount: 39,
    cloneCount: 391,
    isFeatured: false,
    createdAt: "",
    updatedAt: "",
  },
  {
    id: "mock-5",
    kind: "report_spec",
    title: "Rapport Audience Mensuel",
    description: "Tableau de bord audience : acquisition, rétention, géo.",
    authorDisplayName: "data-studio",
    authorTenantId: "hearst-builtin",
    tags: ["audience"],
    ratingAvg: 3.9,
    ratingCount: 15,
    cloneCount: 158,
    isFeatured: false,
    createdAt: "",
    updatedAt: "",
  },
  {
    id: "mock-6",
    kind: "persona",
    title: "Persona Journaliste Enquête",
    description: "Assiste la rédaction longue : vérification sources, angles narratifs.",
    authorDisplayName: "newsroom-ai",
    authorTenantId: "hearst-builtin",
    tags: ["newsroom", "enquête"],
    ratingAvg: 4.7,
    ratingCount: 27,
    cloneCount: 276,
    isFeatured: false,
    createdAt: "",
    updatedAt: "",
  },
];

const FILTERS = ["Tout", "Workflow", "Rapport", "Persona"] as const;

export default function MarketplacePage() {
  return (
    <StandalonePageFrame>
      <ScreenShell
        title="Marketplace"
        subtitle="Templates communautaires · workflows, rapports, personas"
        back={{ label: "Cockpit", href: "/" }}
      >
        <div
          className="flex flex-col sm:flex-row sm:items-center"
          style={{ gap: "var(--space-3)", marginBottom: "var(--space-6)" }}
        >
          <SearchField placeholder="Rechercher un template…" disabled className="flex-1" />
          <FilterTabs tabs={FILTERS} active="Tout" aria-label="Filtrer par type" inline />
        </div>

        <div
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
          style={{ gap: "var(--space-4)", maxWidth: "var(--width-center-max)" }}
        >
          {MOCK_TEMPLATES.map((template) => (
            <MarketplaceTemplateCard key={template.id} template={template} />
          ))}
        </div>
      </ScreenShell>
    </StandalonePageFrame>
  );
}
