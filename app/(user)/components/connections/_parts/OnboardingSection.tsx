"use client";

import { AppLogo } from "../AppLogo";
import { type ComposioApp, STARTER_PICKS } from "../types";

export function OnboardingStage({
  apps,
  onSelect,
}: {
  apps: ComposioApp[];
  onSelect: (app: ComposioApp) => void;
}) {
  const starters = STARTER_PICKS.map((slug) => apps.find((a) => a.key === slug)).filter(
    (a): a is ComposioApp => Boolean(a),
  );

  return (
    <div className="pb-2">
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

function StarterTile({ app, onClick }: { app: ComposioApp; onClick: () => void }) {
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
      <span className="t-9 font-light text-text-accent-teal-deep opacity-0 group-hover:opacity-100 transition-opacity">
        Connecter →
      </span>
    </button>
  );
}
