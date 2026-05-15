"use client";

import type { SpatialPanelCardProps } from "@/lib/spatial/panel-registry";
import { useFocalStore } from "@/stores/focal";
import { CockpitCardShell } from "./CockpitCardShell";

/**
 * Card AssetPreview — preview d'un asset fraîchement généré.
 *
 * Apparaît quand un nouvel asset est ajouté à useFocalStore.secondary
 * ou à useFocalStore.focal (et type !== 'brief').
 *
 * Catégorie ephemeral : disparaît après 30s sans interaction.
 */
export function CockpitAssetPreviewCard(_props: SpatialPanelCardProps) {
  const focal = useFocalStore((s) => s.focal);
  const isAsset = focal && focal.type !== "brief";

  if (!isAsset) {
    return (
      <CockpitCardShell>
        <div className="flex h-full items-center text-spatial-sm font-light text-white/40">
          Aucun asset en focus
        </div>
      </CockpitCardShell>
    );
  }

  return (
    <CockpitCardShell>
      <div className="flex h-full flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-spatial-xs font-semibold uppercase tracking-[0.2em] text-white/45">
            Nouveau · {focal.type}
          </span>
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{
              background: "rgba(0,229,204,0.9)",
              boxShadow: "0 0 10px rgba(0,229,204,0.6)",
            }}
          />
        </div>

        <div className="text-spatial-2xl font-extralight tracking-tight text-white/95 line-clamp-2">
          {focal.title || "Sans titre"}
        </div>

        {focal.summary && (
          <p className="text-spatial-base font-light leading-[1.6] text-white/65 line-clamp-3">
            {focal.summary}
          </p>
        )}

        {focal.wordCount !== undefined && (
          <div className="mt-auto flex items-baseline gap-2 text-white/95">
            <span className="text-spatial-2xl font-light tracking-[-0.04em]">
              {focal.wordCount}
            </span>
            <span className="text-spatial-sm font-light text-white/45">mots</span>
          </div>
        )}
      </div>
    </CockpitCardShell>
  );
}
