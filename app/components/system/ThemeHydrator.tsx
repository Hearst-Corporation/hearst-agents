"use client";

/**
 * ThemeHydrator — synchronise le thème côté client avec la préférence user
 * stockée en DB (via /api/user/theme). Lit le cookie en SSR via root layout,
 * puis vérifie côté client si la préférence serveur diverge.
 *
 * Posé une fois dans app/layout.tsx, sous {children}.
 */

import { useEffect } from "react";
import { applyTheme, isKnownTheme } from "@/lib/themes";

interface Props {
  initial: string;
}

export function ThemeHydrator({ initial }: Props) {
  useEffect(() => {
    if (initial && isKnownTheme(initial)) {
      document.documentElement.dataset.theme = initial;
    }

    const ctrl = new AbortController();
    fetch("/api/user/theme", { signal: ctrl.signal, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const slug = data?.slug;
        if (slug && isKnownTheme(slug) && slug !== initial) {
          applyTheme(slug);
        }
      })
      .catch(() => {
        // 401 / offline → on garde la préférence locale
      });

    return () => ctrl.abort();
  }, [initial]);

  return null;
}
