// lint-visual-disable-file
"use client";

import { Canvas } from "@react-three/fiber";
import { Environment, Float, PerspectiveCamera, Lightformer } from "@react-three/drei";
import { LogoCore } from "./LogoCore";
import { OrbitalAgents } from "./OrbitalAgents";
import { Suspense } from "react";

interface SceneProps {
  stage: "idle" | "focus" | "mission" | "asset";
  hoveredNode: string | null;
  onLogoClick: () => void;
}

export function Scene({ stage, hoveredNode, onLogoClick }: SceneProps) {
  return (
    <div className="absolute inset-0 z-0 bg-black">
      <Canvas>
        <PerspectiveCamera makeDefault position={[0, 0, 10]} fov={45} />
        
        <color attach="background" args={["#000000"]} />
        
        <ambientLight intensity={0.2} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} />
        <pointLight position={[-10, -10, -10]} intensity={0.5} />

        <Suspense fallback={null}>
          <Environment resolution={512}>
            {/* Éclairage studio — un seul softbox top + un fill arrière
               pour avoir une silhouette sphérique sans caustiques en croix. */}
            <Lightformer intensity={3} position={[0, 4, 4]} scale={[8, 8, 1]} />
            <Lightformer intensity={1.2} position={[0, -2, -6]} scale={[10, 10, 1]} />
          </Environment>

          <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.5}>
            <LogoCore stage={stage} hoveredNode={hoveredNode} onClick={onLogoClick} />
          </Float>

          {stage === "mission" && <OrbitalAgents />}
        </Suspense>
      </Canvas>
    </div>
  );
}
