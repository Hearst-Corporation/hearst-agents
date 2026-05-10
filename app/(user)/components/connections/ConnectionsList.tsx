"use client";

import { AppLogo } from "./AppLogo";
import {
  CATEGORIES_VISIBLE,
  STARTER_PICKS,
  categoryLabel,
  stageVariant,
  type ComposioApp,
} from "./types";

// ─── Header sticky : search globale + counters inline ─────────

export function Header({
  searchQuery,
  onSearchChange,
  connectedCount,
  catalogCount,
  attentions,
  attentionFilter,
  onToggleAttentionFilter,
}: {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  connectedCount: number;
  catalogCount: number;
  attentions: number;
  attentionFilter: boolean;
  onToggleAttentionFilter: () => void;
}) {
  return (
    <div
      className="sticky top-0 z-10 flex items-center gap-4 px-8 py-3 border-b"
      style={{ background: "var(--bg-elev)", borderColor: "var(--border-shell)" }}
    >
      {/* Search globale — l'icône loupe et le placeholder suffisent. Pas de
       *  kbd ⌘K ici : le raccourci global ouvre le Commandeur (cf. PulseBar),
       *  pas ce search local. Mentir sur la hotkey casse la confiance UI. */}
      <label
        className="flex-1 flex items-center gap-3 px-0 py-3 border-b rounded-none transition-colors"
        style={{
          background: "transparent",
          borderColor: searchQuery ? "var(--accent-teal)" : "var(--border-shell)",
          borderBottomWidth: "1px",
          borderBottomStyle: "solid",
        }}
      >
        <span className="t-13 leading-none text-text-faint">⌕</span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Cherche un service…"
          className="flex-1 bg-transparent outline-none border-none t-13 text-text placeholder:text-text-faint"
        />
      </label>

      <div className="flex items-center gap-3 t-11 font-light whitespace-nowrap tabular-nums">
        <span className="flex items-center gap-2 text-text-soft">
          <span
            className="w-1 h-1 rounded-pill halo-dot"
            style={{ background: "var(--accent-teal)" }}
            aria-hidden
          />
          {connectedCount}
        </span>
        <span className="text-text-ghost">/</span>
        <span className="text-text-faint">{catalogCount}</span>
        {attentions > 0 && (
          <button
            type="button"
            onClick={onToggleAttentionFilter}
            aria-pressed={attentionFilter}
            title={
              attentionFilter
                ? "Cliquer pour réinitialiser le filtre"
                : "Filtrer le catalogue aux services qui demandent ton attention"
            }
            className="flex items-center gap-1.5 px-2 py-1 rounded-pill border ml-1 transition-colors cursor-pointer"
            style={{
              color: attentionFilter ? "var(--bg)" : "var(--text-soft)",
              background: attentionFilter ? "var(--color-error)" : "transparent",
              borderColor: attentionFilter
                ? "var(--color-error)"
                : "var(--border-soft)",
              fontWeight: attentionFilter
                ? "var(--weight-semibold)"
                : "var(--weight-regular)",
            }}
          >
            <span
              aria-hidden
              className="w-1.5 h-1.5 rounded-pill"
              style={{
                background: attentionFilter ? "var(--bg)" : "var(--color-error)",
                boxShadow: attentionFilter
                  ? undefined
                  : "0 0 6px color-mix(in srgb, var(--color-error) 50%, transparent)",
              }}
            />
            {attentions}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Section label sobre — pas de marker éditorial ────────────

export function SectionLabel({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-baseline gap-2 px-8 pt-5 pb-3 t-13 font-light">
      <span className="text-text-soft">{label}</span>
      <span className="text-text-ghost">·</span>
      <span className="text-text-faint tabular-nums">{count}</span>
    </div>
  );
}

// ─── Stage — grosses tiles carrées des connectés ──────────────

export function Stage({
  apps,
  statusBySlug,
  onSelect,
}: {
  apps: ComposioApp[];
  statusBySlug: Map<string, string>;
  onSelect: (app: ComposioApp) => void;
}) {
  return (
    <div
      className="grid gap-6 px-8 pb-6"
      style={{
        gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))",
      }}
    >
      {apps.map((app) => (
        <StageTile
          key={app.key}
          app={app}
          status={statusBySlug.get(app.key) ?? "active"}
          onClick={() => onSelect(app)}
        />
      ))}
    </div>
  );
}

function StageTile({
  app,
  status,
  onClick,
}: {
  app: ComposioApp;
  status: string;
  onClick: () => void;
}) {
  const variant = stageVariant(status);
  const dotColor =
    variant === "warn" ? "var(--color-warning)"
      : variant === "error" ? "var(--color-error)"
        : null;
  const statusLabel =
    variant === "warn" ? "OAuth en cours"
      : variant === "error" ? "À reconnecter"
        : null;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${app.name}${statusLabel ? ` — ${statusLabel}` : ""}`}
      className="group flex flex-col items-center gap-2"
    >
      {/* Le dot apparaît uniquement quand l'état diverge de la norme
       *  (warn = OAuth en cours, error = à reconnecter). Section
       *  « Connectés » ⇒ pas besoin de signaler que c'est connecté.
       *  Une seule alerte qui crie > dix dots qui chuchotent. */}
      <span className="relative inline-flex">
        <AppLogo app={app} size={48} />
        {dotColor && (
          <span
            aria-hidden
            className="absolute w-2 h-2 rounded-pill"
            style={{
              top: "calc(-1 * var(--space-1))",
              right: "calc(-1 * var(--space-1))",
              background: dotColor,
              boxShadow: `0 0 8px color-mix(in srgb, ${dotColor} 60%, transparent)`,
              animation: variant === "warn" ? "blink 1.4s infinite" : undefined,
            }}
          />
        )}
      </span>
      <span
        className="t-11 text-center group-hover:text-(--accent-teal) transition-colors"
        style={{
          fontWeight: "var(--weight-regular)",
          color: "var(--text-soft)",
          lineHeight: "var(--leading-snug)",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          wordBreak: "break-word",
        }}
      >
        {app.name}
      </span>
      {statusLabel && dotColor && (
        <span
          className="t-9 font-light"
          style={{ color: dotColor }}
        >
          {statusLabel}
        </span>
      )}
    </button>
  );
}

export function OnboardingStage({
  apps,
  onSelect,
}: {
  apps: ComposioApp[];
  onSelect: (app: ComposioApp) => void;
}) {
  const starters = STARTER_PICKS
    .map((slug) => apps.find((a) => a.key === slug))
    .filter((a): a is ComposioApp => Boolean(a));

  return (
    <div className="px-8 pb-2">
      {starters.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {starters.map((app) => (
            <StarterTile key={app.key} app={app} onClick={() => onSelect(app)} />
          ))}
        </div>
      ) : (
        <div
          className="px-6 py-8 text-center rounded-none border-b border-(--border-shell)"
          style={{
            background: "transparent",
          }}
        >
          <p className="t-13 text-text-soft">
            Pioche un logo dans le catalogue ci-dessous pour étendre ton agent.
          </p>
        </div>
      )}
    </div>
  );
}

function StarterTile({
  app,
  onClick,
}: {
  app: ComposioApp;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-center gap-2 transition-opacity hover:opacity-90"
    >
      <AppLogo app={app} size={48} />
      <span
        className="t-11 text-center group-hover:text-(--accent-teal) transition-colors"
        style={{
          fontWeight: "var(--weight-medium)",
          color: "var(--text)",
          lineHeight: "var(--leading-snug)",
        }}
      >
        {app.name}
      </span>
      <span
        className="t-9 font-light text-[var(--accent-teal-deep)] opacity-0 group-hover:opacity-100 transition-opacity"
      >
        Connecter →
      </span>
    </button>
  );
}

// ─── Suggestions : strip horizontal compact ────────────────────

export function SuggestionsGrid({
  suggestions,
  onSelect,
}: {
  suggestions: { app: ComposioApp; hint: string }[];
  onSelect: (app: ComposioApp) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 px-8 pb-6">
      {suggestions.map((s) => (
        <SuggestionCard
          key={s.app.key}
          app={s.app}
          hint={s.hint}
          onClick={() => onSelect(s.app)}
        />
      ))}
    </div>
  );
}

function SuggestionCard({
  app,
  hint,
  onClick,
}: {
  app: ComposioApp;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center gap-4 text-left transition-colors"
    >
      <AppLogo app={app} size={40} />
      <div className="flex-1 min-w-0">
        <div
          className="t-13 truncate group-hover:text-(--accent-teal) transition-colors"
          style={{
            fontWeight: "var(--weight-medium)",
            color: "var(--text-soft)",
          }}
        >
          {app.name}
        </div>
        <div
          className="t-11 mt-1 text-text-faint truncate"
          style={{ lineHeight: "var(--leading-snug)" }}
        >
          {hint}
        </div>
      </div>
      <span
        className="text-text-ghost group-hover:text-[var(--accent-teal-deep)] transition-colors"
        aria-hidden
      >
        →
      </span>
    </button>
  );
}

// ─── Categories bar — chips scrollables, filtre le wallpaper ──

export function CategoriesBar({
  categories,
  active,
  onChange,
  totalCount,
}: {
  categories: { id: string; label: string; count: number }[];
  active: string | null;
  onChange: (cat: string | null) => void;
  /** Total dédupliqué d'apps non-connectées. Sommer `categories[].count`
   *  double-compte les services présents dans plusieurs catégories. */
  totalCount: number;
}) {
  const visible = categories.slice(0, CATEGORIES_VISIBLE);
  const hiddenCount = Math.max(0, categories.length - visible.length);
  return (
    <div
      className="flex items-center gap-6 px-8 py-3 overflow-x-auto"
      style={{
        borderTop: "1px solid var(--border-shell)",
      }}
    >
      <CategoryChip
        label="Tout"
        count={totalCount}
        on={active === null}
        onClick={() => onChange(null)}
      />
      {visible.map((c) => (
        <CategoryChip
          key={c.id}
          label={c.label}
          count={c.count}
          on={active === c.id}
          onClick={() => onChange(active === c.id ? null : c.id)}
        />
      ))}
      {hiddenCount > 0 && (
        <span className="t-11 font-light whitespace-nowrap text-text-faint ml-auto">
          + {hiddenCount} catégorie{hiddenCount > 1 ? "s" : ""}
        </span>
      )}
    </div>
  );
}

function CategoryChip({
  label,
  count,
  on,
  onClick,
}: {
  label: string;
  count: number;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="t-11 whitespace-nowrap transition-colors"
      style={{
        color: on ? "var(--accent-teal)" : "var(--text-faint)",
        fontWeight: on ? "var(--weight-semibold)" : "var(--weight-regular)",
      }}
    >
      {label}
      <span
        className="ml-2"
        style={{ color: on ? "var(--accent-teal)" : "var(--text-ghost)", opacity: on ? 0.6 : 1 }}
      >
        {count}
      </span>
    </button>
  );
}

// ─── Wallpaper — grille dense du catalogue ─────────────────────

export function Wallpaper({
  apps,
  totalFiltered,
  connectedSlugs,
  statusBySlug,
  onSelect,
  canLoadMore,
  onLoadMore,
}: {
  apps: ComposioApp[];
  totalFiltered: number;
  connectedSlugs: Set<string>;
  statusBySlug: Map<string, string>;
  onSelect: (app: ComposioApp) => void;
  canLoadMore: boolean;
  onLoadMore: () => void;
}) {
  return (
    <div className="px-8 pt-4 pb-8">
      {apps.length === 0 ? (
        <p className="t-13 font-light text-center py-10 text-text-faint">
          Aucun service dans cette catégorie.
        </p>
      ) : (
        <div className="grid grid-cols-6 sm:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2">
          {apps.map((app) => (
            <WallpaperTile
              key={app.key}
              app={app}
              connected={connectedSlugs.has(app.key)}
              status={statusBySlug.get(app.key)}
              onClick={() => onSelect(app)}
            />
          ))}
        </div>
      )}
      <div
        className="mt-5 pt-4 flex items-center justify-between t-11 font-light border-t"
        style={{
          borderColor: "var(--border-shell)",
          color: "var(--text-faint)",
        }}
      >
        <span>
          {apps.length} / {totalFiltered}
        </span>
        {canLoadMore && (
          <button
            type="button"
            onClick={onLoadMore}
            className="text-[var(--accent-teal-deep)] hover:text-(--accent-teal) transition-colors"
          >
            charger plus →
          </button>
        )}
      </div>
    </div>
  );
}

function WallpaperTile({
  app,
  connected,
  status,
  onClick,
}: {
  app: ComposioApp;
  connected: boolean;
  status: string | undefined;
  onClick: () => void;
}) {
  // Trois états visuels :
  //  - connected      : couleur normale + dot accent-teal en coin + ring accent-teal
  //  - connectable    : grayscale léger (0.55) + retour couleur au hover
  //  - non-connectable: grayscale fort (0.85) + cadenas SVG en coin
  // Le cadenas vient d'un mini SVG inline (pas d'emoji — interdit par DS).
  const isConnectable = app.connectable !== false; // undefined = legacy, on assume connectable
  const variant = connected ? stageVariant(status ?? "active") : "active";
  const dotColor =
    variant === "warn" ? "var(--color-warning)"
      : variant === "error" ? "var(--color-error)"
        : "var(--accent-teal)";

  // Connecté = couleur native (signal fort, cohérent avec la section
  // « Connectés » en haut). Non-connecté connectable = grayscale léger.
  // Non-connectable = grayscale fort + cadenas. Une représentation par état.
  const filter = connected
    ? undefined
    : isConnectable
      ? "grayscale(0.55) opacity(0.65)"
      : "grayscale(0.95) opacity(0.4)";

  return (
    <button
      type="button"
      onClick={onClick}
      title={isConnectable ? app.name : `${app.name} — config Composio requise`}
      aria-label={app.name}
      className="group relative aspect-square flex items-center justify-center rounded-none border transition-all"
      style={{
        borderColor: connected ? "var(--accent-teal-border)" : "var(--border-soft)",
        filter,
      }}
    >
      <AppLogo app={app} size={28} />
      {connected && (
        <span
          aria-hidden
          className="absolute w-2 h-2 rounded-pill"
          style={{
            top: "calc(-1 * var(--space-1))",
            right: "calc(-1 * var(--space-1))",
            background: dotColor,
            boxShadow: `0 0 4px color-mix(in srgb, ${dotColor} 60%, transparent)`,
          }}
        />
      )}
      {!connected && !isConnectable && <LockBadge />}
    </button>
  );
}

// Mini SVG cadenas pour les tiles non-connectables (auth-config Composio
// manquante). Couleur via currentColor → hérite de var(--text-faint).
function LockBadge() {
  return (
    <span
      aria-hidden
      className="absolute top-1 right-1 inline-flex items-center justify-center"
      style={{ color: "var(--text-faint)" }}
    >
      <svg width="9" height="11" viewBox="0 0 16 20" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="9" width="12" height="9" rx="1.5" />
        <path d="M5 9V6a3 3 0 0 1 6 0v3" strokeLinecap="round" />
      </svg>
    </span>
  );
}

// ─── Search globale (résultats) ────────────────────────────────

export function SearchResultsSection({
  results,
  totalCount,
  connectedSlugs,
  onSelect,
}: {
  results: ComposioApp[];
  totalCount: number;
  connectedSlugs: Set<string>;
  onSelect: (app: ComposioApp) => void;
}) {
  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center gap-3 px-8">
        <p className="t-15 font-medium text-text-muted">
          Aucun résultat
        </p>
      </div>
    );
  }
  return (
    <div className="px-8 pt-8 pb-8">
      <div className="flex items-baseline gap-2 mb-4 t-13 font-medium">
        <span className="text-text">Résultats</span>
        <span className="text-text-ghost">·</span>
        <span className="text-text-faint font-light">
          {results.length} sur {totalCount}
        </span>
      </div>
      <div className="flex flex-col divide-y">
        {results.map((app) => (
          <button
            key={app.key}
            type="button"
            onClick={() => onSelect(app)}
            className="group flex items-center gap-3 px-8 py-3 text-left transition-colors rounded-none"
            style={{
              background: "transparent",
              borderBottom: "1px solid var(--border-soft)",
            }}
          >
            <AppLogo app={app} size={32} />
            <div className="flex-1 min-w-0">
              <div
                className="t-13 truncate"
                style={{ fontWeight: "var(--weight-semibold)", color: "var(--text)" }}
              >
                {app.name}
              </div>
              <div className="t-11 font-light mt-1 text-text-faint truncate">
                {connectedSlugs.has(app.key) ? "Connecté" : categoryLabel(app)}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
