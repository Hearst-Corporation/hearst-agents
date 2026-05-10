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
      <Canvas dpr={[1, 2]}>
        <PerspectiveCamera makeDefault position={[0, 0, 10]} fov={35} />
        
        {/* Pure black background */}
        <color attach="background" args={["#000000"]} />
        
        {/* Minimal ambient light to avoid gray washing */}
        <ambientLight intensity={0.05} />
        
        {/* Sharp key light for specular highlights */}
        <spotLight position={[10, 15, 10]} angle={0.15} penumbra={1} intensity={1} color="#ffffff" />
        
        <Suspense fallback={null}>
          <Environment resolution={1024}>
            {/* 
              Éclairage "strips" type studio automobile / VisionOS.
              Des lignes pures et fines pour créer des reflets cristallins et élégants 
              sur la surface clearcoat du verre, sans effet "lumière diffuse".
            */}
            <group rotation={[-Math.PI / 4, 0, 0]}>
              {/* Highlight sommital fin et puissant */}
              <Lightformer form="rect" intensity={5} position={[0, 4, 0]} scale={[10, 0.1, 1]} />
              
              {/* Highlight bas très fin pour souligner la courbure */}
              <Lightformer form="rect" intensity={2} position={[0, -4, 0]} scale={[10, 0.1, 1]} />
            </group>
            
            <group rotation={[0, Math.PI / 2, 0]}>
              {/* Highlights latéraux tranchants pour les bords du verre */}
              <Lightformer form="rect" intensity={4} position={[0, 0, 5]} scale={[10, 0.05, 1]} />
              <Lightformer form="rect" intensity={4} position={[0, 0, -5]} scale={[10, 0.05, 1]} />
            </group>
          </Environment>

          {/* Lenteur, inertie très légère pour la présence IA */}
          <Float speed={0.4} rotationIntensity={0.05} floatIntensity={0.15}>
            <LogoCore stage={stage} hoveredNode={hoveredNode} onClick={onLogoClick} />
          </Float>

          {stage === "mission" && <OrbitalAgents />}
        </Suspense>
      </Canvas>
    </div>
  );
}
