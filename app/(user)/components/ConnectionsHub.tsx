"use client";

// ============================================================================
//  ConnectionsHub — stage /connections (alias /apps → redirect). Orchestrateur léger.
//
//  Toute la logique métier (state, fetch, dedup Composio/native, OAuth flow,
//  popup polling, postMessage listener) vit dans `useConnectionsHub` pour
//  garder ce shell focalisé sur la composition visuelle.
//
//  Sous-composants UI dans `./connections/_parts/` :
//   - HeaderSection    : Header + SectionLabel (search globale, counters)
//   - ConnectedStage   : grille des services connectés
//   - OnboardingSection: onboarding stage (aucun connecté)
//   - CatalogSection   : Wallpaper + CategoriesBar
//   - SuggestionsSection / SearchResults
//   - AppDrawer        : drawer modal app détail + actions du connecteur
//   - AppLogo          : primitive logo (couleur native marque, fallback init)
//
//  Surface publique : `<ConnectionsHub />` — inchangée. Les invariants de la
//  feature `connections` (write-guard, OAuth popup synchrone, dedup
//  Composio>native, etc.) sont préservés intégralement.
// ============================================================================

import { CategoriesBar, Wallpaper } from "./connections/_parts/CatalogSection";
import { Stage } from "./connections/_parts/ConnectedStage";
import { Header, SectionLabel } from "./connections/_parts/HeaderSection";
import { OnboardingStage } from "./connections/_parts/OnboardingSection";
import { SearchResultsSection } from "./connections/_parts/SearchResults";
import { SuggestionsGrid } from "./connections/_parts/SuggestionsSection";
import { AppDrawer } from "./connections/AppDrawer";
import { useConnectionsHub } from "./connections/use-connections-hub";

export function ConnectionsHub() {
  const hub = useConnectionsHub();

  if (!hub.enabled) return <DisabledState message={hub.sdkError} />;
  if (hub.loading) return <LoadingState />;

  return (
    <section className="preserve-3d flex w-full max-w-[var(--width-connections-max)] flex-col 2xl:max-w-[var(--width-connections-max-wide)] pb-12 animate-[fu_0.4s_ease-out_forwards]">
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
        <div className="flex flex-col gap-8">
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
              <div className="pb-3">
                <button
                  type="button"
                  onClick={hub.onClearAttentionFilter}
                  className="t-11 font-medium text-text-accent-teal-deep hover:text-(--accent-teal) transition-colors"
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
            hub.busy === hub.liveDrawer.app.key || hub.busy === hub.liveDrawer.connectedAccount?.id
          }
          onClose={hub.closeDrawer}
          onConnect={() => hub.handleConnect(hub.liveDrawer!.app)}
          onDisconnect={
            hub.liveDrawer.connectedAccount
              ? () => hub.handleDisconnect(hub.liveDrawer?.connectedAccount!)
              : undefined
          }
        />
      )}
    </section>
  );
}

// ─── States ───────────────────────────────────────────────────

function DisabledState({ message }: { message: string | null }) {
  return (
    <section className="preserve-3d flex w-full max-w-[var(--width-connections-max)] flex-col 2xl:max-w-[var(--width-connections-max-wide)] items-center justify-center gap-4 py-24 animate-[fu_0.4s_ease-out_forwards]">
      <p className="t-15 font-medium text-text-muted">Composio indisponible</p>
      <p className="t-13 text-text-soft max-w-md text-center leading-relaxed">
        {message ?? "Composio n'est pas configuré."}
      </p>
      <p className="t-11 text-text-faint max-w-md text-center leading-relaxed">
        Vérifie <code className="text-(--accent-teal)">COMPOSIO_API_KEY</code> dans{" "}
        <code>.env.local</code>.
      </p>
    </section>
  );
}

function LoadingState() {
  return (
    <section className="preserve-3d flex w-full max-w-[var(--width-connections-max)] flex-col 2xl:max-w-[var(--width-connections-max-wide)] items-center justify-center gap-4 py-24 animate-[fu_0.4s_ease-out_forwards]">
      <div className="halo-core" aria-hidden />
      <p className="t-11 font-light text-text-muted">Chargement des connexions…</p>
    </section>
  );
}
