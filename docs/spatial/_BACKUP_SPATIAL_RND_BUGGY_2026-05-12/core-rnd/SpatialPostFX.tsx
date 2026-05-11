"use client";

import { EffectComposer, DepthOfField, Bloom, Vignette, Noise } from "@react-three/postprocessing";
import { useSpatialSceneStore } from "@/stores/spatial-scene";
import { useSpatialSelection } from "@/stores/spatial-selection";
import { panelRegistry } from "@/lib/spatial/panel-registry";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

export function SpatialPostFX() {
  const config = useSpatialSceneStore((state) => state.postFX);
  const selected = useSpatialSelection((s) => s.selected);
  const dofRef = useRef<any>(null);
  const targetFocusDistance = useRef(config.dof.focusDistance);

  useFrame(() => {
    if (selected.length > 0) {
      const id = selected[0];
      const pos = panelRegistry.get(id);
      if (pos) {
        // Mapping inverse approximatif: Z = -2 -> 0.02, Z = -18 -> 0.1
        // Formule simple pour la v1: focusDistance = abs(Z) / 200 (ajustable)
        targetFocusDistance.current = Math.abs(pos.z) / 200;
      }
    } else {
      targetFocusDistance.current = config.dof.focusDistance;
    }

    if (dofRef.current) {
      dofRef.current.focusDistance = THREE.MathUtils.lerp(
        dofRef.current.focusDistance,
        targetFocusDistance.current,
        0.05
      );
    }
  });

  return (
    <EffectComposer>
      <DepthOfField
        ref={dofRef}
        focusDistance={config.dof.focusDistance}
        focalLength={config.dof.focalLength}
        bokehScale={config.dof.bokehScale}
      />
      <Bloom
        intensity={config.bloom.intensity}
        luminanceThreshold={config.bloom.luminanceThreshold}
        luminanceSmoothing={0.1}
      />
      <Vignette eskil={false} offset={config.vignette.offset} darkness={config.vignette.darkness} />
      <Noise opacity={config.noise.opacity} />
    </EffectComposer>
  );
}
