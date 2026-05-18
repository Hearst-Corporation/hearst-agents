/**
 * Tests unitaires pour parseAssetFetchResult (AssetStage.tsx).
 *
 * Couvre :
 *  1. Réponse wrapped { asset: {...} } + focalAssetId → [asset]
 *  2. Réponse plate { id, title } (ancien bug, flat) + focalAssetId → [] (régression)
 *  3. Réponse liste { assets: [...] } + focalAssetId null → tableau complet
 */

import { describe, expect, it } from "vitest";
import { parseAssetFetchResult } from "@/app/(user)/_stages/AssetStage";

describe("parseAssetFetchResult", () => {
  it("{ asset: { id, title } } + focalAssetId → longueur 1, id correct", () => {
    const data = { asset: { id: "x", title: "t", kind: "image" } };
    const result = parseAssetFetchResult(data, "x");
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("x");
  });

  it("{ id, title } flat (ancien bug) + focalAssetId → longueur 0 (régression couverte)", () => {
    // L'ancien code faisait (data as ApiAsset).id → retournait [data] à tort.
    // Le nouveau helper attend { asset: {...} } → retourne [] si asset absent.
    const data = { id: "x", title: "t", kind: "image" };
    const result = parseAssetFetchResult(data, "x");
    expect(result).toHaveLength(0);
  });

  it("{ assets: [{id:'a'},{id:'b'}] } + focalAssetId null → longueur 2", () => {
    const data = {
      assets: [
        { id: "a", title: "Asset A", kind: "image" },
        { id: "b", title: "Asset B", kind: "video" },
      ],
    };
    const result = parseAssetFetchResult(data, null);
    expect(result).toHaveLength(2);
  });
});
