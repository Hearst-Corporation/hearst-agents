// lint-visual-disable-file
"use client";

import { Suspense, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, PerspectiveCamera, Lightformer } from "@react-three/drei";
import { SCENE_CONFIG } from "@/lib/spatial/constants";

interface SpatialSceneProps {
  children: ReactNode;
  className?: string;
}

/**
 * Conteneur WebGL de base — canvas R3F + éclairage studio.
 * Aucune logique métier. Reçoit les enfants 3D via props.
 */
export function SpatialScene({ children, className }: SpatialSceneProps) {
  const { camera, environment } = SCENE_CONFIG;

  return (
    <div className={`absolute inset-0 bg-black ${className ?? ""}`}>
      <Canvas>
        <PerspectiveCamera
          makeDefault
          position={camera.position}
          fov={camera.fov}
        />

        <color attach="background" args={["#000000"]} />

        <ambientLight intensity={0.2} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} />
        <pointLight position={[-10, -10, -10]} intensity={0.5} />

        <Suspense fallback={null}>
          <Environment resolution={environment.resolution}>
            <Lightformer intensity={3} position={[0, 4, 4]} scale={[8, 8, 1]} />
            <Lightformer intensity={1.2} position={[0, -2, -6]} scale={[10, 10, 1]} />
          </Environment>

          {children}
        </Suspense>
      </Canvas>
    </div>
  );
}
