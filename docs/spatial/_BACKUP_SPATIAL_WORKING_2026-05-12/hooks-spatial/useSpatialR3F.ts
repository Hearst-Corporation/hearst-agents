"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Hook utilitaire pour animer un objet R3F avec lerp vers une cible.
 * Retourne la ref et une fonction pour setter la cible.
 */
export function useLerpedScale(initialScale = 1, lerpFactor = 0.08) {
  const meshRef = useRef<THREE.Mesh>(null);
  const targetScale = useRef(initialScale);

  useFrame(() => {
    if (!meshRef.current) return;
    meshRef.current.scale.lerp(
      new THREE.Vector3(targetScale.current, targetScale.current, targetScale.current),
      lerpFactor
    );
  });

  return {
    ref: meshRef,
    setTargetScale: (s: number) => { targetScale.current = s; },
  };
}

/**
 * Hook pour orbiter un mesh autour du centre avec des ellipses.
 */
export function useOrbitalPosition(
  radiusX: number,
  radiusZ: number,
  speed: number,
  phase = 0,
  verticalAmplitude = 0
) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.getElapsedTime() * speed + phase;
    meshRef.current.position.x = Math.cos(t) * radiusX;
    meshRef.current.position.z = Math.sin(t) * radiusZ;
    if (verticalAmplitude) {
      meshRef.current.position.y = Math.sin(t * 0.7) * verticalAmplitude;
    }
  });

  return meshRef;
}

/**
 * Hook pour la rotation Y lente d'un groupe (background, rings, etc.)
 */
export function useSlowRotation(speedY = 0.1, speedX = 0) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime();
    groupRef.current.rotation.y = t * speedY;
    if (speedX) groupRef.current.rotation.x = Math.sin(t * speedX) * 0.2;
  });

  return groupRef;
}
