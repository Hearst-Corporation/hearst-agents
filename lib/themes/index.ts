/**
 * Theme runtime — applique le thème sur `<html data-theme>` et persiste localement.
 *
 * Le serveur peut être source de vérité (préférence user en DB) — on synchronise
 * via `/api/user/theme` côté ThemeHydrator.
 */

import { REGISTRY } from "@/themes/_registry";
import type { Theme } from "./types";

export const DEFAULT_THEME = "default";
const STORAGE_KEY = "hearst-theme";
const COOKIE_KEY = "theme";

export type ThemeSlug = string;

export function listThemes(): Theme[] {
  return REGISTRY;
}

export function getTheme(slug: string): Theme | undefined {
  return REGISTRY.find((t) => t.slug === slug);
}

export function isKnownTheme(slug: string): boolean {
  return REGISTRY.some((t) => t.slug === slug);
}

export const THEME_CHANGE_EVENT = "hearst:theme-change";

export function applyTheme(slug: ThemeSlug): void {
  if (typeof document === "undefined") return;
  const safe = isKnownTheme(slug) ? slug : DEFAULT_THEME;
  document.documentElement.dataset.theme = safe;
  try {
    localStorage.setItem(STORAGE_KEY, safe);
    document.cookie = `${COOKIE_KEY}=${encodeURIComponent(safe)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  } catch {
    // localStorage indisponible (mode privé) — on s'en passe
  }
  window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: { slug: safe } }));
}

export function subscribeThemeChange(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(THEME_CHANGE_EVENT, cb);
  return () => window.removeEventListener(THEME_CHANGE_EVENT, cb);
}

export function getCurrentTheme(): ThemeSlug {
  if (typeof document === "undefined") return DEFAULT_THEME;
  const fromAttr = document.documentElement.dataset.theme;
  if (fromAttr && isKnownTheme(fromAttr)) return fromAttr;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && isKnownTheme(stored)) return stored;
  } catch {}
  return DEFAULT_THEME;
}
