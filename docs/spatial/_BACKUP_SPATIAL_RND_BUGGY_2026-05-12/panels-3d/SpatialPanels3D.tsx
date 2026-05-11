"use client";

import { useSpatialSelection } from "@/stores/spatial-selection";
import { PanelKPI3D, PanelMission3D, PanelBrief3D } from "./Panels3D";

export function SpatialPanels3D() {
  const unselectAll = useSpatialSelection((s) => s.unselectAll);

  return (
    <group name="spatial-panels-layer">
      {/* Background click to deselect */}
      <mesh 
        name="spatial-background-deselect"
        position={[0, 0, -20]} 
        onPointerDown={(e) => {
          e.stopPropagation();
          unselectAll();
        }}
        visible={false}
      >
        <planeGeometry args={[200, 200]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      <PanelKPI3D position={[-3.5, 1.5, -2]} entityId="kpi" />
      <PanelMission3D position={[0, 0.5, -4]} entityId="mission" />
      <PanelBrief3D position={[3.5, 1.5, -2]} entityId="brief" />
    </group>
  );
}
