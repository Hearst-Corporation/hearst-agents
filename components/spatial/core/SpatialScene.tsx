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

        <Suspense fallback={null}>
          <Environment resolution={environment.resolution}>
            <Lightformer
              form="rect"
              intensity={2.8}
              color="#ffffff"
              position={[0, 4, 4]}
              scale={[7, 5, 1]}
            />
            <Lightformer
              form="rect"
              intensity={4.2}
              color="#ffffff"
              position={[-3.2, 0.2, 3]}
              scale={[0.22, 5.8, 1]}
            />
            <Lightformer
              form="rect"
              intensity={3.4}
              color="#ffffff"
              position={[0, -2.2, 3]}
              scale={[5.8, 0.18, 1]}
            />
          </Environment>

          {children}
        </Suspense>
      </Canvas>
    </div>
  );
}
