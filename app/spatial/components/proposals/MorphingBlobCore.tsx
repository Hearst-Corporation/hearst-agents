"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Sphere, MeshDistortMaterial } from "@react-three/drei";

interface CoreProps {
  stage: "idle" | "focus" | "mission" | "asset";
  hoveredNode: string | null;
  onClick: () => void;
}

export function MorphingBlobCore({ stage, hoveredNode, onClick }: CoreProps) {
  const groupRef = useRef<THREE.Group>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Three.js material type complex, prototype hors DS
  const materialRef = useRef<any>(null);
  const targetScale = useMemo(() => new THREE.Vector3(1, 1, 1), []);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    
    if (groupRef.current) {
      groupRef.current.rotation.y = time * 0.2;
      groupRef.current.rotation.z = time * 0.1;
      
      let scale = 1;
      if (stage === "focus") scale = 1.3;
      if (stage === "mission") scale = 0.8;
      if (stage === "asset") scale = 0.6;
      
      targetScale.set(scale, scale, scale);
      groupRef.current.scale.lerp(targetScale, 0.1);
    }

    if (materialRef.current) {
      materialRef.current.distort = THREE.MathUtils.lerp(
        materialRef.current.distort,
        hoveredNode ? 0.6 : (stage === "focus" ? 0.4 : 0.2),
        0.1
      );
      materialRef.current.speed = THREE.MathUtils.lerp(
        materialRef.current.speed,
        hoveredNode ? 4 : (stage === "focus" ? 2 : 1),
        0.1
      );
    }
  });

  return (
    <group 
      ref={groupRef}
      onClick={onClick}
      onPointerOver={() => document.body.style.cursor = 'pointer'} 
      onPointerOut={() => document.body.style.cursor = 'auto'}
    >
      <Sphere args={[1.2, 64, 64]}>
        <MeshDistortMaterial
          ref={materialRef}
          color={hoveredNode ? "#ffffff" : "#0a0a0c"}
          envMapIntensity={2}
          clearcoat={1}
          clearcoatRoughness={0.1}
          metalness={0.8}
          roughness={0.2}
          distort={0.2}
          speed={1}
        />
      </Sphere>
    </group>
  );
}
