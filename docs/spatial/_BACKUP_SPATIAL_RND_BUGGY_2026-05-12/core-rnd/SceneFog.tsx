"use client";

import { useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useSpatialSceneStore } from "@/stores/spatial-scene";

export function SceneFog() {
  const { scene } = useThree();
  const fogConfig = useSpatialSceneStore((state) => state.fog);
  const bgColor = useSpatialSceneStore((state) => state.background);

  const fog = useMemo(() => new THREE.FogExp2(fogConfig.color, fogConfig.density), []);

  useEffect(() => {
    fog.color.set(fogConfig.color);
    fog.density = fogConfig.density;
    scene.fog = fog;
    scene.background = new THREE.Color(bgColor);
  }, [scene, fog, fogConfig.color, fogConfig.density, bgColor]);

  return null;
}
