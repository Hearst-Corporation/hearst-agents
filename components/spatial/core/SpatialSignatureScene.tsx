// lint-visual-disable-file
"use client";

import { SpatialScene } from "./SpatialScene";
import { SpatialOrbCore } from "./SpatialOrbCore";
import { OrbitalRing } from "@/components/spatial/orbital/OrbitalRing";
import type { SpatialStage } from "@/lib/spatial/types";

interface SpatialSignatureSceneProps {
  stage: SpatialStage;
  hovered?: boolean;
  onOrbClick?: () => void;
}

/**
 * Scène signature — orbe central + ring orbital qui se révèle en mission.
 * Aucune logique métier, simple composition de briques.
 */
export function SpatialSignatureScene({
  stage,
  hovered,
  onOrbClick,
}: SpatialSignatureSceneProps) {
  const ringOpacity = stage === "mission" ? 1 : 0;

  return (
    <SpatialScene>
      <SpatialOrbCore stage={stage} hovered={hovered} onClick={onOrbClick} />
      <OrbitalRing opacity={ringOpacity} />
    </SpatialScene>
  );
}
