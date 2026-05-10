/**
 * AssetStage — primitives partagées.
 *
 * Centralise les constantes et types réutilisés par les sous-composants
 * du module `asset-stage` (header, body, hero, hooks, prompt block).
 */

/** Longueur max d'affichage du prompt avant troncation "Voir plus / Réduire". */
export const PROMPT_TRUNCATE_LENGTH = 200;

/** Status du polling de variant image. */
export type ImageStatus = "idle" | "pending" | "ready" | "failed";

/**
 * Formatter date stable serveur ↔ client (timezone Europe/Paris) — évite
 * l'hydration mismatch SSR (UTC) vs client (timezone locale).
 */
export const ASSET_DATE_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});
