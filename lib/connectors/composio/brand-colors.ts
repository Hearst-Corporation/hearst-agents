/**
 * Couleurs de marque officielles des providers OAuth — utilisées par la
 * palette de nodes (mission builder) et autres surfaces qui affichent un
 * logo provider sans pouvoir réutiliser une teinte du DS.
 *
 * Ces hex sont des couleurs de marque tierces (Gmail, Slack, Google
 * Calendar/Drive) — pas des tokens du design system Hearst OS, ne pas
 * tenter de les remplacer par des `var(--*)`.
 */

export const BRAND_COLORS = {
  gmail: "#EA4335",
  slack: "#4A154B",
  googleCalendar: "#1A73E8",
  googleDrive: "#34A853",
  /** Recherche web — Google grey (pas une vraie marque, mais cohérence visuelle). */
  searchWeb: "#5F6368",
} as const;

export type BrandColorKey = keyof typeof BRAND_COLORS;
