"use client";

import { useEffect } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useSpatialSceneStore } from "@/stores/spatial-scene";

export function SceneCamera({ devMode }: { devMode: boolean }) {
  const { camera } = useThree();
  const camConfig = useSpatialSceneStore((state) => state.camera);

  // Cast propre de la caméra
  const perspectiveCamera = camera as THREE.PerspectiveCamera;

  // En mode prod, on applique la config de la caméra à chaque frame
  // En mode dev, OrbitControls prend le relais
  useFrame(() => {
    if (!devMode) {
      perspectiveCamera.position.set(camConfig.position[0], camConfig.position[1], camConfig.position[2]);
      perspectiveCamera.lookAt(camConfig.lookAt[0], camConfig.lookAt[1], camConfig.lookAt[2]);
    }
  });

  useEffect(() => {
    perspectiveCamera.fov = camConfig.fov;
    perspectiveCamera.updateProjectionMatrix();
  }, [perspectiveCamera, camConfig.fov]);

  return null;
}
