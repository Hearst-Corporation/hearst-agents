"use client";

import { Sparkles } from "@react-three/drei";
import { useSpatialSceneStore } from "@/stores/spatial-scene";

export function SpatialDustField() {
  const config = useSpatialSceneStore((state) => state.dust);
  
  return (
    <group name="dust-field" position={config.position}>
      <Sparkles
        count={config.count}
        scale={config.scale}
        size={config.size}
        speed={config.speed}
        opacity={config.opacity}
        color={config.color}
      />
    </group>
  );
}
