/**
 * AssetVariantTabs — Re-export depuis le module éclaté.
 *
 * Le composant a été découpé en sous-modules (orchestrateur, tab, preview,
 * actions, empty state, modale enrichissement, fork panel, hook polling)
 * pour réduire la taille du fichier source. Cet alias préserve l'API
 * publique (named export) et évite tout breaking import.
 *
 * Voir `./asset-variant-tabs/AssetVariantTabs.tsx`.
 */

export { AssetVariantTabs } from "./asset-variant-tabs/AssetVariantTabs";
