"use client";

import { useState } from "react";
import { StandalonePageFrame } from "@/app/(user)/components/standalone/StandalonePageFrame";
import { Action, FilterTabs, PanelCard, ScreenShell } from "@/app/(user)/components/ui";

type StatusLabel = "publié" | "brouillon" | "archivé";
type DomainLabel = "Performance" | "Audience" | "Revenue" | "Hôtellerie";

interface Report {
  id: number;
  title: string;
  domain: DomainLabel;
  status: StatusLabel;
  updatedAt: string;
  authorInitials: string;
}

const REPORTS: Report[] = [
  {
    id: 1,
    title: "Performance Édition Printemps",
    domain: "Performance",
    status: "publié",
    updatedAt: "17 mai 2026",
    authorInitials: "AB",
  },
  {
    id: 2,
    title: "Audience Q1 2026",
    domain: "Audience",
    status: "publié",
    updatedAt: "14 mai 2026",
    authorInitials: "LC",
  },
  {
    id: 3,
    title: "Revenue Publicitaire Avril",
    domain: "Revenue",
    status: "brouillon",
    updatedAt: "10 mai 2026",
    authorInitials: "AB",
  },
  {
    id: 4,
    title: "RevPAR Semaine 20",
    domain: "Hôtellerie",
    status: "publié",
    updatedAt: "16 mai 2026",
    authorInitials: "MR",
  },
];

const STATUS_STYLES: Record<StatusLabel, string> = {
  publié: "bg-(--color-success)/10 text-(--color-success) border border-(--color-success)/25",
  brouillon: "bg-(--warn)/10 text-(--warn) border border-(--warn)/25",
  archivé: "bg-(--surface-2) text-text-ghost border border-(--border-shell)",
};

const DOMAIN_STYLES: Record<DomainLabel, string> = {
  Performance: "text-(--color-info)",
  Audience: "text-(--accent-llm)",
  Revenue: "text-(--color-success)",
  Hôtellerie: "text-(--warn)",
};

const FILTERS = ["Tout", "Performance", "Audience", "Revenue", "Hôtellerie"] as const;
type Filter = (typeof FILTERS)[number];

export default function ReportsPage() {
  const [activeFilter, setActiveFilter] = useState<Filter>("Tout");

  const filteredReports =
    activeFilter === "Tout" ? REPORTS : REPORTS.filter((r) => r.domain === activeFilter);

  return (
    <StandalonePageFrame>
      <ScreenShell
        title="Rapports"
        subtitle="Bibliothèque · Analyse · Distributions"
        actions={
          <Action variant="primary" tone="neutral" size="md" href="/reports/studio" iconRight="→">
            Nouveau rapport
          </Action>
        }
      >
        <FilterTabs
          tabs={FILTERS}
          active={activeFilter}
          aria-label="Filtrer les rapports"
          onValueChange={(v) => setActiveFilter(v as Filter)}
        />

        <div
          className="grid grid-cols-1 md:grid-cols-2"
          style={{ gap: "var(--space-4)", maxWidth: "var(--width-center-max)" }}
        >
          {filteredReports.map((r) => (
            <PanelCard key={r.id} hover className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span
                  className={`t-9 font-medium rounded-pill ${STATUS_STYLES[r.status]}`}
                  style={{ padding: "var(--space-1) var(--space-2-5)" }}
                >
                  {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                </span>
                <div
                  className="flex items-center justify-center rounded-full bg-(--surface-2) t-11 font-medium text-text-muted"
                  style={{ width: "var(--size-avatar-sm)", height: "var(--size-avatar-sm)" }}
                >
                  {r.authorInitials}
                </div>
              </div>
              <div>
                <p className="t-13 font-medium text-text">{r.title}</p>
                <p className={`t-11 font-medium mt-1 ${DOMAIN_STYLES[r.domain]}`}>{r.domain}</p>
              </div>
              <p className="t-11 font-light text-text-ghost mt-auto">Mis à jour le {r.updatedAt}</p>
            </PanelCard>
          ))}
        </div>
      </ScreenShell>
    </StandalonePageFrame>
  );
}
