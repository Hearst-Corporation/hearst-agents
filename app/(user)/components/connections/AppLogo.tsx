"use client";

import type { ComposioApp } from "./types";

// Logo (couleur native marque, frame neutre). Utilisé partout dans le hub :
// stage tiles, suggestions, wallpaper, search results, drawer header.
export function AppLogo({ app, size = 16 }: { app: ComposioApp; size?: number }) {
  const wrapperClass =
    "shrink-0 inline-flex items-center justify-center overflow-hidden rounded-none";
  const inner = size >= 32 ? Math.round(size * 0.78) : size;

  if (app.logo?.startsWith("http")) {
    return (
      <span className={wrapperClass} style={{ width: size, height: size }}>
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
        width: size,
        height: size,
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
