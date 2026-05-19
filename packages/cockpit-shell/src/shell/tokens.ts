/**
 * Tokens partagés du Cockpit côté JS.
 * Source de vérité CSS : packages/cockpit-shell/tokens.css (--ct-accent).
 * Ce littéral est le fallback unique quand aucune couleur produit n'est fournie
 * et que la var CSS --ct-accent n'est pas résolue (SSR, contexte hors DOM).
 */
export const DEFAULT_PRODUCT_COLOR = "#8A1538";
