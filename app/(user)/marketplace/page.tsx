"use client";

/**
 * /marketplace — browse des templates publics partagés.
 *
 * Filtres : kind (workflow / report_spec / persona / all), search, featured.
 * Grid responsive 1/2/3 colonnes.
 */

import { useEffect, useMemo, useState } from "react";
import { ScreenShell } from "../components/ui";
import { MarketplaceTemplateCard } from "../components/marketplace/MarketplaceTemplateCard";
import type { MarketplaceTemplateSummary } from "@/lib/marketplace/types";

type KindFilter =
  | "all"
  | "workflow"
  | "report_spec"
  | "persona"
  | "creative_prompt";

const KIND_TABS: ReadonlyArray<{ value: KindFilter; label: string }> = [
  { value: "all", label: "Tous" },
  { value: "workflow", label: "Workflows" },
  { value: "report_spec", label: "Rapports" },
  { value: "persona", label: "Personas" },
  { value: "creative_prompt", label: "Packs créatifs" },
];

interface PersonaLite {
  id: string;
  isDefault: boolean;
}

export default function MarketplacePage() {
  const [templates, setTemplates] = useState<MarketplaceTemplateSummary[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [kind, setKind] = useState<KindFilter>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activePersonaId, setActivePersonaId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  // Persona active = celle marquée isDefault (best-effort, fail-soft).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/v2/personas", { credentials: "include" });
        if (cancelled || !res.ok) return;
        const body = (await res.json()) as { personas?: PersonaLite[] };
        const def = body.personas?.find((p) => p.isDefault);
        if (!cancelled && def) setActivePersonaId(def.id);
      } catch {
        // fail-soft : pas de reco si l'API est down
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const params = new URLSearchParams();
    if (kind !== "all") params.set("kind", kind);
    if (debouncedSearch) params.set("q", debouncedSearch);
    params.set("limit", "60");

    void (async () => {
      if (!cancelled) setIsLoading(true);
      try {
        const res = await fetch(`/api/v2/marketplace/templates?${params.toString()}`, {
          credentials: "include",
        });
        if (cancelled) return;
        if (!res.ok) {
          setError(`HTTP ${res.status}`);
          setTemplates([]);
          setIsLoading(false);
          return;
        }
        const body = (await res.json()) as { templates: MarketplaceTemplateSummary[] };
        if (!cancelled) {
          setTemplates(body.templates ?? []);
          setError(null);
          setIsLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "fetch_failed");
          setTemplates([]);
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [kind, debouncedSearch, retryCount]);

  const isEmpty = !isLoading && !error && templates !== null && templates.length === 0;

  const recommendedIds = useMemo(() => {
    if (!activePersonaId || !templates) return new Set<string>();
    return new Set(
      templates
        .filter((t) => t.recommendedFor?.includes(activePersonaId))
        .map((t) => t.id),
    );
  }, [activePersonaId, templates]);

  const recommended = useMemo(
    () =>
      (templates ?? []).filter((t) => recommendedIds.has(t.id)),
    [templates, recommendedIds],
  );
  const featured = useMemo(
    () =>
      (templates ?? []).filter(
        (t) => t.isFeatured && !recommendedIds.has(t.id),
      ),
    [templates, recommendedIds],
  );
  const others = useMemo(
    () =>
      (templates ?? []).filter(
        (t) => !t.isFeatured && !recommendedIds.has(t.id),
      ),
    [templates, recommendedIds],
  );

  return (
    <ScreenShell
      title="Marketplace"
      subtitle="Templates communautaires — workflows, rapports, personas. Clone en un clic."
      breadcrumb={[{ label: "Hearst", href: "/" }, { label: "Marketplace" }]}
      loading={isLoading}
      loadingVariant="cards"
      empty={
        isEmpty
          ? {
              title: "Aucun template trouvé",
              description:
                "Sois le premier à publier — depuis le Studio, le Builder ou la page Personas.",
            }
          : undefined
      }
    >
      <div
        className="mx-auto w-full flex flex-col gap-6"
        style={{ maxWidth: "var(--width-actions)" }}
      >
        {/* Filters */}
        <section
          className="flex flex-wrap items-center justify-between gap-3"
        >
          <div
            data-testid="marketplace-kind-tabs"
            className="flex flex-wrap gap-1"
          >
            {KIND_TABS.map((tab) => {
              const active = tab.value === kind;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setKind(tab.value)}
                  data-testid={`kind-tab-${tab.value}`}
                  className="t-11 font-light transition-colors"
                  style={{
                    padding: "var(--space-2) var(--space-3)",
                    color: active ? "var(--text)" : "var(--text-ghost)",
                    background: active ? "var(--accent-teal-surface)" : "transparent",
                    border: `1px solid ${active ? "var(--accent-teal)" : "var(--line-strong)"}`,
                    borderRadius: "var(--radius-pill)",
                    cursor: "pointer",
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="flex gap-2">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un template…"
              data-testid="marketplace-search"
              className="t-11 text-text focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-teal-border-hover)]"
              style={{
                padding: "var(--space-2) var(--space-3)",
                background: "var(--surface-1)",
                border: "1px solid var(--line-strong)",
                borderRadius: "var(--radius-sm)",
                minWidth: "var(--space-32)",
              }}
            />
          </div>
        </section>

        {error && (
          <div className="flex items-center gap-4">
            <p className="t-11 font-light" style={{ color: "var(--danger)" }}>
              Erreur : {error}
            </p>
            <button
              type="button"
              onClick={() => { setError(null); setTemplates(null); setRetryCount((n) => n + 1); }}
              className="t-11 font-light border-b transition-colors"
              style={{ color: "var(--text-muted)", borderColor: "var(--line-strong)" }}
            >
              Réessayer
            </button>
          </div>
        )}

        {!isLoading && !isEmpty && (
          <>
            {recommended.length > 0 && (
              <section className="flex flex-col gap-3">
                <h2 className="t-11 font-medium text-(--accent-teal)">
                  Recommandé pour vous
                </h2>
                <Grid templates={recommended} recommendedIds={recommendedIds} />
              </section>
            )}
            {featured.length > 0 && (
              <section className="flex flex-col gap-3">
                <h2 className="t-11 font-medium text-(--accent-teal)">
                  Featured
                </h2>
                <Grid templates={featured} recommendedIds={recommendedIds} />
              </section>
            )}
            <section className="flex flex-col" style={{ gap: "var(--space-3)" }}>
              {(featured.length > 0 || recommended.length > 0) && (
                <h2 className="t-11 font-light text-text-faint">
                  Tous les templates
                </h2>
              )}
              <Grid templates={others} recommendedIds={recommendedIds} />
            </section>
          </>
        )}
      </div>
    </ScreenShell>
  );
}

function Grid({
  templates,
  recommendedIds,
}: {
  templates: MarketplaceTemplateSummary[];
  recommendedIds: Set<string>;
}) {
  return (
    <div
      data-testid="marketplace-grid"
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3"
    >
      {templates.map((t) => (
        <MarketplaceTemplateCard
          key={t.id}
          template={t}
          recommended={recommendedIds.has(t.id)}
        />
      ))}
    </div>
  );
}
