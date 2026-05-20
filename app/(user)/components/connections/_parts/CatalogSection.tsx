"use client";

import { Chip } from "@/app/(user)/components/ui/Chip";
import { AppLogo } from "../AppLogo";
import { CATEGORIES_VISIBLE, type ComposioApp, stageVariant } from "../types";

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
  /** Total dédupliqué d'apps non-connectées. */
  totalCount: number;
}) {
  const visible = categories.slice(0, CATEGORIES_VISIBLE);
  const hiddenCount = Math.max(0, categories.length - visible.length);
  return (
    <div
      className="flex items-center gap-6 py-3 overflow-x-auto"
      style={{
        borderTop: "1px solid color-mix(in srgb, var(--border-default) 40%, transparent)",
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
    <div className="pt-4 pb-8">
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
  const isConnectable = app.connectable !== false;
  const variant = connected ? stageVariant(status ?? "active") : "active";
  const dotColor =
    variant === "warn"
      ? "var(--color-warning)"
      : variant === "error"
        ? "var(--color-error)"
        : "var(--accent-teal)";

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
      className="group relative aspect-square flex items-center justify-center rounded-none border transition-[border-color,filter] duration-(--duration-slow) ease-(--ease-standard)"
      style={{
        borderColor: connected ? "var(--accent-teal-border)" : "var(--border-soft)",
        filter,
      }}
    >
      <AppLogo app={app} size={28} />
      {connected && (
        <Chip
          aria-hidden
          variant="dot"
          className="absolute"
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

// Mini SVG cadenas pour les tiles non-connectables.
function LockBadge() {
  return (
    <span
      aria-hidden
      className="absolute top-1 right-1 inline-flex items-center justify-center"
      style={{ color: "var(--text-faint)" }}
    >
      <svg
        width="9"
        height="11"
        viewBox="0 0 16 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <rect x="2" y="9" width="12" height="9" rx="1.5" />
        <path d="M5 9V6a3 3 0 0 1 6 0v3" strokeLinecap="round" />
      </svg>
    </span>
  );
}
