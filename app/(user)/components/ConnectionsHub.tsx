"use client";

// ============================================================================
//  ConnectionsHub — page /apps. Orchestrateur léger.
//
//  Toute la logique métier (state, fetch, dedup Composio/native, OAuth flow,
//  popup polling, postMessage listener) vit dans `useConnectionsHub` pour
//  garder ce shell focalisé sur la composition visuelle.
//
//  Sous-composants UI dans `./connections/` :
//   - ConnectionsList : Header, sections Connectés / Pour aller plus loin /
//                        Catalogue, search results
//   - AppDrawer        : drawer modal app détail + actions du connecteur
//   - AppLogo          : primitive logo (couleur native marque, fallback init)
//
//  Surface publique : `<ConnectionsHub />` — inchangée. Les invariants de la
//  feature `connections` (write-guard, OAuth popup synchrone, dedup
//  Composio>native, etc.) sont préservés intégralement.
// ============================================================================

import { AppDrawer } from "./connections/AppDrawer";
import {
  CategoriesBar,
  Header,
  OnboardingStage,
  SearchResultsSection,
  SectionLabel,
  Stage,
  SuggestionsGrid,
  Wallpaper,
} from "./connections/ConnectionsList";
import { useConnectionsHub } from "./connections/use-connections-hub";

export function ConnectionsHub() {
  const hub = useConnectionsHub();

  if (!hub.enabled) return <DisabledState message={hub.sdkError} />;
  if (hub.loading) return <LoadingState />;

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: "var(--bg-elev)" }}>
      <Header
        searchQuery={hub.searchQuery}
        onSearchChange={hub.setSearchQuery}
        connectedCount={hub.stats.connectedCount}
        catalogCount={hub.stats.catalogCount}
        attentions={hub.stats.attentions}
        attentionFilter={hub.attentionFilter}
        onToggleAttentionFilter={hub.onToggleAttentionFilter}
      />

      {hub.searchResults !== null ? (
        <SearchResultsSection
          results={hub.searchResults}
          totalCount={hub.apps.length}
          connectedSlugs={hub.connectedSlugs}
          onSelect={hub.openDrawer}
        />
      ) : (
        <div
          className="flex flex-col"
          style={{ padding: "var(--space-4)", gap: "var(--space-4)" }}
        >
          {/* CONNECTÉS */}
          <div>
            <SectionLabel label="Connectés" count={hub.stats.connectedCount} />
            {hub.connectedApps.length > 0 ? (
              <Stage
                apps={hub.connectedApps}
                statusBySlug={hub.statusBySlug}
                onSelect={hub.openDrawer}
              />
            ) : (
              <OnboardingStage apps={hub.apps} onSelect={hub.openDrawer} />
            )}
          </div>

          {/* POUR ALLER PLUS LOIN */}
          {hub.suggestions.length > 0 && (
            <div>
              <SectionLabel label="Pour aller plus loin" count={hub.suggestions.length} />
              <SuggestionsGrid suggestions={hub.suggestions} onSelect={hub.openDrawer} />
            </div>
          )}

          {/* CATALOGUE */}
          <div>
            <SectionLabel
              label={hub.attentionFilter ? "À vérifier" : "Catalogue"}
              count={hub.wallpaperApps.length}
            />
            {hub.attentionFilter && (
              <div className="px-8 pb-3">
                <button
                  type="button"
                  onClick={hub.onClearAttentionFilter}
                  className="t-11 font-medium text-[var(--accent-teal-deep)] hover:text-(--accent-teal) transition-colors"
                >
                  ← Voir tout le catalogue
                </button>
              </div>
            )}
            {!hub.attentionFilter && (
              <CategoriesBar
                categories={hub.categoriesWithCount}
                active={hub.activeCategory}
                onChange={hub.onCategoryChange}
                totalCount={hub.wallpaperBase.length}
              />
            )}
            <Wallpaper
              apps={hub.wallpaperVisible}
              totalFiltered={hub.wallpaperApps.length}
              connectedSlugs={hub.connectedSlugs}
              statusBySlug={hub.statusBySlug}
              onSelect={hub.openDrawer}
              canLoadMore={hub.wallpaperVisible.length < hub.wallpaperApps.length}
              onLoadMore={hub.onLoadMoreWallpaper}
            />
          </div>
        </div>
      )}

      {hub.liveDrawer && (
        <AppDrawer
          state={hub.liveDrawer}
          actions={hub.drawerActions}
          loadingActions={hub.drawerLoadingActions}
          busy={
            hub.busy === hub.liveDrawer.app.key ||
            hub.busy === hub.liveDrawer.connectedAccount?.id
          }
          onClose={hub.closeDrawer}
          onConnect={() => hub.handleConnect(hub.liveDrawer!.app)}
          onDisconnect={
            hub.liveDrawer.connectedAccount
              ? () => hub.handleDisconnect(hub.liveDrawer!.connectedAccount!)
              : undefined
          }
        />
      )}
    </div>
  );
}

// ─── States ───────────────────────────────────────────────────

function DisabledState({ message }: { message: string | null }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8 py-24">
      <p className="t-15 font-medium text-text-muted">
        Composio indisponible
      </p>
      <p className="t-13 text-text-soft max-w-md text-center leading-relaxed">
        {message ?? "Composio n'est pas configuré."}
      </p>
      <p className="t-11 text-text-faint max-w-md text-center leading-relaxed">
        Vérifie <code className="text-(--accent-teal)">COMPOSIO_API_KEY</code> dans{" "}
        <code>.env.local</code>.
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8 py-24">
      <div className="halo-core" aria-hidden />
      <p className="t-11 font-light text-text-muted">Chargement des connexions…</p>
    </div>
  );
}
