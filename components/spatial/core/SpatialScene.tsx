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
              intensity={0.38}
              color="#ffffff"
              position={[0, 6.4, 2.2]}
              scale={[7.8, 0.52, 1]}
            />
            <Lightformer
              form="rect"
              intensity={0.82}
              color="#ffffff"
              position={[-7.2, 0, 1.8]}
              scale={[0.05, 6.2, 1]}
            />
            <Lightformer
              form="rect"
              intensity={0.82}
              color="#ffffff"
              position={[7.2, 0, 1.8]}
              scale={[0.05, 6.2, 1]}
            />
            <Lightformer
              form="rect"
              intensity={0.92}
              color="#ffffff"
              position={[0, -3.2, 2.6]}
              scale={[4.2, 0.06, 1]}
            />
          </Environment>

          {children}
        </Suspense>
      </Canvas>
    </div>
  );
}
