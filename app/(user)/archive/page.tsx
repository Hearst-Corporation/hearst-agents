"use client";

import { useEffect, useMemo, useState } from "react";
import { StandalonePageFrame } from "@/app/(user)/components/standalone/StandalonePageFrame";
import {
  FilterTabs,
  PanelCard,
  ScreenShell,
  SearchField,
  StageErrorBanner,
} from "@/app/(user)/components/ui";

const TABS = ["Tout", "Threads", "Assets"] as const;
type Tab = (typeof TABS)[number];

interface ArchiveItem {
  id: string;
  title: string;
  created_at: string;
  kind: "thread" | "asset";
}

interface ArchiveResponse {
  threads: Array<{ id: string; title: string; created_at: string }>;
  assets: Array<{ id: string; title: string; created_at: string }>;
}

function useArchive() {
  const [items, setItems] = useState<ArchiveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchArchive = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/v2/archive");
        if (!res.ok) {
          throw new Error(`Erreur ${res.status} lors du chargement de l'archive`);
        }
        const data = (await res.json()) as ArchiveResponse;
        const mapped: ArchiveItem[] = [
          ...(data.threads ?? []).map((t) => ({ ...t, kind: "thread" as const })),
          ...(data.assets ?? []).map((a) => ({ ...a, kind: "asset" as const })),
        ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setItems(mapped);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur inconnue");
        setItems([]);
      } finally {
        setLoading(false);
      }
    };

    fetchArchive();
  }, []);

  return { items, loading, error };
}

const KIND_STYLES: Record<ArchiveItem["kind"], { badge: string; label: string }> = {
  thread: {
    badge: "bg-(--color-info)/10 text-(--color-info) border border-(--color-info)/25",
    label: "Thread",
  },
  asset: {
    badge: "bg-(--accent-llm)/10 text-(--accent-llm) border border-(--accent-llm)/25",
    label: "Asset",
  },
};

export default function ArchivePage() {
  const [activeTab, setActiveTab] = useState<Tab>("Tout");
  const [searchQuery, setSearchQuery] = useState("");
  const { items, loading, error } = useArchive();

  const filteredItems = useMemo(() => {
    let result = items;
    if (activeTab === "Threads") {
      result = result.filter((i) => i.kind === "thread");
    } else if (activeTab === "Assets") {
      result = result.filter((i) => i.kind === "asset");
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter((i) => i.title.toLowerCase().includes(q));
    }
    return result;
  }, [items, activeTab, searchQuery]);

  const formattedDate = (iso: string) =>
    new Date(iso).toLocaleDateString("fr-FR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  return (
    <StandalonePageFrame>
      <ScreenShell
        title="Archive"
        subtitle="Threads et assets de plus de 7 jours"
        back={{ label: "Cockpit", href: "/" }}
        loading={loading}
        loadingVariant="rows"
        empty={
          !loading && items.length === 0 && !error
            ? {
                title: "Aucun élément archivé",
                description: "Les éléments de plus de 7 jours apparaîtront ici.",
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
              <SearchField
                type="search"
                aria-label="Rechercher dans l'archive"
                placeholder="Rechercher dans l'archive…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1"
              />
              <FilterTabs
                tabs={TABS}
                active={activeTab}
                aria-label="Filtrer l'archive"
                inline
                onValueChange={(v) => setActiveTab(v as Tab)}
              />
            </div>

            {filteredItems.length === 0 && !loading && (
              <p className="t-13 text-text-ghost">Aucun résultat ne correspond à vos critères.</p>
            )}

            <div
              className="grid grid-cols-1 md:grid-cols-2"
              style={{ gap: "var(--space-4)", maxWidth: "var(--width-center-max)" }}
            >
              {filteredItems.map((item) => {
                const style = KIND_STYLES[item.kind];
                return (
                  <PanelCard key={`${item.kind}-${item.id}`} hover className="flex flex-col gap-3">
                    <span
                      className={`t-9 font-medium rounded-pill inline-flex w-fit ${style.badge}`}
                      style={{ padding: "var(--space-1) var(--space-2-5)" }}
                    >
                      {style.label}
                    </span>
                    <div>
                      <p className="t-13 font-medium text-text leading-snug">{item.title}</p>
                      <p className="t-11 font-light text-text-ghost mt-1">
                        Archivé le {formattedDate(item.created_at)}
                      </p>
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
