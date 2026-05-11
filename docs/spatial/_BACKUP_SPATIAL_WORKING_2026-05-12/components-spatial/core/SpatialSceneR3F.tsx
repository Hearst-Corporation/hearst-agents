"use client";

import { Canvas } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import { SpatialEnvironment } from "./SpatialEnvironment";
import { SpatialDustField } from "./SpatialDustField";
import { SpatialPostFX } from "./SpatialPostFX";
import { SpatialDevHelpers } from "../dev/SpatialDevHelpers";
import { SceneFog } from "./SceneFog";
import { SceneCamera } from "./SceneCamera";
import { SpatialPanels3D } from "../panels-3d/SpatialPanels3D";
import { SpatialChatParticles } from "../panels-3d/SpatialChatParticles";
import { useSpatialCameraFocus } from "@/hooks/spatial/useSpatialCameraFocus";

function GroundFog() {
  return (
    <mesh name="ground-fog" position={[0, -2.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[100, 100]} />
      <meshBasicMaterial 
        color="#1a2540" 
        transparent 
        opacity={0.4} 
        depthWrite={false}
      />
    </mesh>
  );
}

function CameraController() {
  useSpatialCameraFocus();
  return null;
}

export function SpatialSceneR3F({ devMode }: { devMode: boolean }) {
  return (
    <div className="absolute inset-0 z-0 bg-[#040508]">
      <Canvas
        gl={{ antialias: true, powerPreference: "high-performance" }}
        shadows={false}
        dpr={[1, 2]}
      >
        <SceneFog />
        <SceneCamera devMode={devMode} />
        <CameraController />
        <Stars 
          radius={50} 
          depth={50} 
          count={150} 
          factor={4} 
          saturation={0} 
          fade 
          speed={1} 
        />
        <SpatialEnvironment />
        <GroundFog />
        <SpatialPanels3D />
        <SpatialChatParticles />
        <SpatialDustField />
        <SpatialPostFX />
        
        {devMode && <SpatialDevHelpers />}
      </Canvas>
    </div>
  );
}
