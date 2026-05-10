"use client";

import type { Asset } from "@/lib/assets/types";
import { AssetLineage } from "../../AssetLineage";
import { useSelectionStore } from "@/stores/selection";
import { useStageStore } from "@/stores/stage";
import { ASSET_DATE_FORMATTER } from "./shared";

interface AssetMetaProps {
  asset: Asset;
}

/**
 * AssetMeta — En-tête éditorial d'un asset texte/rapport.
 *
 * Empile :
 *  - <AssetLineage> (provenance B4 — dérivés / sources / coût / latence)
 *  - h1 titre
 *  - ligne meta (kind · date · summary tronqué)
 *
 * Caché en mode image-only — ces infos vivent alors dans le ContextRail
 * droit pour ne pas alourdir le centre.
 *
 * Le clic sur un parent déclenche `setMode("asset")` + select store —
 * cohérent avec invariant assets I-1 (`storeAsset` / `loadAssetById`
 * unique source) côté navigation.
 */
export function AssetMeta({ asset }: AssetMetaProps) {
  return (
    <>
      <AssetLineage
        asset={asset}
        onOpenParent={(parentId) => {
          useSelectionStore.getState().select({ kind: "asset", id: parentId });
          useStageStore.getState().setMode({ mode: "asset", assetId: parentId });
        }}
      />
      <h1
        className="t-28 font-medium tracking-tight text-text"
        style={{ lineHeight: "var(--leading-snug)", marginBottom: "var(--space-3)" }}
      >
        {asset.title}
      </h1>

      <div className="flex items-center gap-3 mb-10 t-11 font-light text-text-faint">
        <span>{asset.kind}</span>
        <span
          className="rounded-pill bg-[var(--text-ghost)]"
          style={{ width: "var(--space-1)", height: "var(--space-1)" }}
        />
        <span>{ASSET_DATE_FORMATTER.format(new Date(asset.createdAt))}</span>
        {asset.summary && (
          <>
            <span
              className="rounded-pill bg-[var(--text-ghost)]"
              style={{ width: "var(--space-1)", height: "var(--space-1)" }}
            />
            <span className="normal-case tracking-normal font-sans text-text-muted truncate">
              {asset.summary}
            </span>
          </>
        )}
      </div>
    </>
  );
}
