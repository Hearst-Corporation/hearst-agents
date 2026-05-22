"use client";

import type { ComposioApp } from "./types";

/**
 * Logo d'app (couleur native marque, frame neutre). Utilisé partout dans le
 * hub connexions : stage tiles, suggestions, wallpaper, search results, drawer.
 *
 * Échelle nommée (pas de px arbitraire) :
 *   sm = 28px (catalogue dense, résultats de recherche)
 *   md = 40px (suggestions)
 *   lg = 48px (drawer header, tuiles starter/connectées)
 */
export type AppLogoSize = "sm" | "md" | "lg";

const SIZE_PX: Record<AppLogoSize, number> = {
  sm: 28,
  md: 40,
  lg: 48,
};

export function AppLogo({ app, size = "md" }: { app: ComposioApp; size?: AppLogoSize }) {
  const px = SIZE_PX[size];
  const wrapperClass =
    "shrink-0 inline-flex items-center justify-center overflow-hidden rounded-none";
  const inner = px >= 32 ? Math.round(px * 0.78) : px;

  if (app.logo?.startsWith("http")) {
    return (
      <span className={wrapperClass} style={{ width: px, height: px }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={app.logo}
          alt=""
          width={inner}
          height={inner}
          className="object-contain"
          style={{ width: inner, height: inner }}
          // Logos cassés côté Composio (URLs mortes) → fallback sur l'init du nom.
          onError={(e) => {
            const el = e.currentTarget;
            el.style.display = "none";
            const parent = el.parentElement;
            if (parent && !parent.dataset.fallback) {
              parent.dataset.fallback = "1";
              parent.style.fontSize = `${inner * 0.6}px`;
              parent.style.color = "var(--text-faint)";
              parent.textContent = app.name?.[0]?.toUpperCase() ?? "·";
            }
          }}
        />
      </span>
    );
  }
  // Fallback (pas de logo distant) : pastille discrète avec l'initiale.
  return (
    <span
      className={wrapperClass}
      style={{
        width: px,
        height: px,
        fontSize: inner * 0.6,
        background: "var(--surface-2)",
        color: "var(--text-faint)",
        borderRadius: "0",
      }}
    >
      {app.name?.[0]?.toUpperCase() ?? "·"}
    </span>
  );
}
