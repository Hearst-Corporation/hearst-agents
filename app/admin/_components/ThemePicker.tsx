"use client";

/**
 * ThemePicker — UI de sélection du thème UI dans l'admin.
 *
 * Click sur une carte → applique localement (data-theme + cookie + localStorage)
 * et persiste côté serveur via POST /api/user/theme. Le thème actif est lu via
 * getCurrentTheme() au mount (lit data-theme posé en SSR par root layout).
 */

import Image from "next/image";
import { useState, useSyncExternalStore, useTransition } from "react";
import { applyTheme, DEFAULT_THEME, getCurrentTheme, subscribeThemeChange } from "@/lib/themes";
import type { Theme } from "@/lib/themes/types";

interface Props {
  themes: Theme[];
}

type SaveState = "idle" | "saving" | "saved" | "error";

export function ThemePicker({ themes }: Props) {
  const active = useSyncExternalStore(
    subscribeThemeChange,
    () => getCurrentTheme(),
    () => DEFAULT_THEME,
  );
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [, startTransition] = useTransition();

  function pick(slug: string) {
    if (slug === active) return;
    applyTheme(slug);
    setSaveState("saving");
    startTransition(() => {
      fetch("/api/user/theme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      })
        .then((r) => {
          setSaveState(r.ok ? "saved" : "error");
          if (r.ok) {
            setTimeout(() => setSaveState("idle"), 1500);
          }
        })
        .catch(() => setSaveState("error"));
    });
  }

  return (
    <div className="space-y-(--space-6)">
      <div className="flex items-center justify-between">
        <p className="text-(--text-muted) t-13">
          {themes.length} thème{themes.length > 1 ? "s" : ""} disponible
          {themes.length > 1 ? "s" : ""}
        </p>
        <span className="t-11 text-(--text-muted)" aria-live="polite">
          {saveState === "saving" && "Sauvegarde…"}
          {saveState === "saved" && "Préférence enregistrée"}
          {saveState === "error" && "Erreur de sauvegarde"}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-(--space-4)">
        {themes.map((t) => {
          const isActive = active === t.slug;
          return (
            <button
              key={t.slug}
              type="button"
              onClick={() => pick(t.slug)}
              aria-pressed={isActive}
              className={`group relative text-left bg-(--bg-elev) rounded-(--radius-2xl) overflow-hidden border transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-(--accent-teal) ${
                isActive
                  ? "border-(--accent-teal)"
                  : "border-(--border) hover:border-(--text-muted)"
              }`}
              style={isActive ? { boxShadow: "0 0 0 1px var(--accent-teal)" } : undefined}
            >
              <div className="relative aspect-[16/10] bg-black overflow-hidden">
                <Image
                  src={t.preview}
                  alt={t.name}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                  className="object-cover"
                  unoptimized={t.preview.endsWith(".svg")}
                />
              </div>
              <div className="p-(--space-4) space-y-(--space-1)">
                <div className="flex items-baseline justify-between gap-(--space-2)">
                  <strong className="text-(--text) t-15 font-medium">{t.name}</strong>
                  {t.capturedAt && (
                    <span className="t-11 text-(--text-muted) font-mono">{t.capturedAt}</span>
                  )}
                </div>
                {t.description && (
                  <p className="t-13 text-(--text-muted) leading-snug line-clamp-2">
                    {t.description}
                  </p>
                )}
                {t.source && (
                  <a
                    href={t.source}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-block t-11 text-(--accent) hover:underline mt-(--space-1)"
                  >
                    source ↗
                  </a>
                )}
              </div>
              {isActive && (
                <span className="absolute top-(--space-2) right-(--space-2) bg-(--accent) text-(--bg) t-11 font-semibold uppercase tracking-wide px-(--space-2) py-0.5 rounded-full">
                  Actif
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
