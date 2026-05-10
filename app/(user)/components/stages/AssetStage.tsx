"use client";

/**
 * AssetStage — re-export shim.
 *
 * L'implémentation vit sous `./asset-stage/`. Ce shim préserve l'import
 * historique `./stages/AssetStage` utilisé par `Stage.tsx` (router).
 */

export { AssetStage } from "./asset-stage/AssetStage";
