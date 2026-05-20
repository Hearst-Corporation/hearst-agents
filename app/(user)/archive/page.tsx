"use client";

import { StandalonePageFrame } from "@/app/(user)/components/standalone/StandalonePageFrame";
import { EmptyState, FilterTabs, ScreenShell, SearchField } from "@/app/(user)/components/ui";

const TABS = ["Tout", "Threads", "Assets", "Missions"] as const;

function ArchiveIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden>
      <rect x="5" y="12" width="30" height="22" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 18h30M15 24h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 12V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export default function ArchivePage() {
  return (
    <StandalonePageFrame>
      <ScreenShell
        title="Archive"
        subtitle="Threads et assets de plus de 7 jours"
        back={{ label: "Cockpit", href: "/" }}
        empty={{
          title: "Aucun élément archivé",
          description: "Les éléments de plus de 7 jours apparaîtront ici",
          icon: <ArchiveIcon />,
        }}
      >
        <SearchField
          type="search"
          aria-label="Rechercher dans l'archive"
          placeholder="Rechercher dans l'archive…"
          style={{ marginBottom: "var(--space-6)" }}
        />
        <FilterTabs tabs={TABS} active="Tout" aria-label="Filtrer l'archive" />
      </ScreenShell>
    </StandalonePageFrame>
  );
}
