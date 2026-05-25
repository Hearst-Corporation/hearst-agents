"use client";

import { useEffect, useState } from "react";
import { StandalonePageFrame } from "@/app/(user)/components/standalone/StandalonePageFrame";
import {
  Action,
  FilterTabs,
  PanelCard,
  ScreenShell,
  StageErrorBanner,
} from "@/app/(user)/components/ui";

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

function useReports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/reports");
        if (!res.ok) {
          throw new Error(`Erreur API: ${res.status}`);
        }
        const data = await res.json();
        // Transformer les rapports du catalogue en Report
        const transformedReports: Report[] = (data.reports || []).map((r: any) => ({
          id: r.id,
          title: r.title,
          domain: (r.domain || "Performance") as DomainLabel,
          status: (r.status === "ready"
            ? "publié"
            : r.status === "partial"
              ? "brouillon"
              : "archivé") as StatusLabel,
          updatedAt: new Date().toLocaleDateString("fr-FR", {
            year: "numeric",
            month: "long",
            day: "numeric",
            timeZone: "Europe/Paris",
          }),
          authorInitials: "HR",
        }));
        setReports(transformedReports);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur inconnue");
        setReports([]);
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, []);

  return { reports, loading, error };
}

export default function ReportsPage() {
  const [activeFilter, setActiveFilter] = useState<Filter>("Tout");
  const { reports, loading, error } = useReports();

  const filteredReports =
    activeFilter === "Tout" ? reports : reports.filter((r) => r.domain === activeFilter);

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
        loading={loading}
        loadingVariant="rows"
        empty={
          !loading && reports.length === 0 && !error
            ? {
                title: "Aucun rapport",
                description: "Commencez par créer votre premier rapport.",
                cta: { label: "Nouveau rapport", href: "/reports/studio" },
              }
            : false
        }
      >
        {error && <StageErrorBanner message={error} />}

        {!error && (
          <>
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
                  <p className="t-11 font-light text-text-ghost mt-auto">
                    Mis à jour le {r.updatedAt}
                  </p>
                </PanelCard>
              ))}
            </div>
          </>
        )}
      </ScreenShell>
    </StandalonePageFrame>
  );
}
