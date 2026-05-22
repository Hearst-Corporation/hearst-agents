"use client";

import { useState } from "react";
import { StandalonePageFrame } from "@/app/(user)/components/standalone/StandalonePageFrame";
import { FilterTabs, ScreenShell, SearchField } from "@/app/(user)/components/ui";

const TABS = ["Tout", "Threads", "Assets", "Missions"] as const;
type Tab = (typeof TABS)[number];

export default function ArchivePage() {
  const [activeTab, setActiveTab] = useState<Tab>("Tout");

  // Aucun endpoint d'archive (threads/assets > 7 jours) n'est implémenté à ce jour.
  // L'empty state est honnête : aucune donnée factice, aucun booléen hardcodé.
  // À brancher sur /api/v2/archive avec loading/error/items dès que l'endpoint existe.

  return (
    <StandalonePageFrame>
      <ScreenShell
        title="Archive"
        subtitle="Threads et assets de plus de 7 jours"
        back={{ label: "Cockpit", href: "/" }}
        empty={{
          title: "Aucun élément archivé",
          description: "Les éléments de plus de 7 jours apparaîtront ici.",
        }}
      >
        <SearchField
          type="search"
          aria-label="Rechercher dans l'archive"
          placeholder="Rechercher dans l'archive…"
          style={{ marginBottom: "var(--space-6)" }}
        />
        <FilterTabs
          tabs={TABS}
          active={activeTab}
          aria-label="Filtrer l'archive"
          onValueChange={(v) => setActiveTab(v as Tab)}
        />
      </ScreenShell>
    </StandalonePageFrame>
  );
}
