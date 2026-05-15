"use client";

import { AppLogo } from "../AppLogo";
import { type ComposioApp, stageVariant } from "../types";

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
    variant === "warn" ? "var(--color-warning)" : variant === "error" ? "var(--color-error)" : null;
  const statusLabel =
    variant === "warn" ? "OAuth en cours" : variant === "error" ? "À reconnecter" : null;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${app.name}${statusLabel ? ` — ${statusLabel}` : ""}`}
      className="group flex flex-col items-center gap-2"
    >
      {/* Le dot apparaît uniquement quand l'état diverge de la norme
       *  (warn = OAuth en cours, error = à reconnecter). Section
       *  « Connectés » ⇒ pas besoin de signaler que c'est connecté. */}
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
        <span className="t-9 font-light" style={{ color: dotColor }}>
          {statusLabel}
        </span>
      )}
    </button>
  );
}
