"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Octahedron, Edges } from "@react-three/drei";

interface CoreProps {
  stage: "idle" | "focus" | "mission" | "asset";
  hoveredNode: string | null;
  onClick: () => void;
}

export function MonolithCore({ stage, hoveredNode, onClick }: CoreProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const targetScale = useMemo(() => new THREE.Vector3(1, 1, 1), []);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    if (meshRef.current) {
      // Flottaison
      meshRef.current.position.y = Math.sin(time * 2) * 0.1;
      meshRef.current.rotation.y = time * 0.2;
      
      let scale = 1;
      if (stage === "focus") scale = 1.3;
      if (stage === "mission") scale = 0.7;
      if (stage === "asset") scale = 0.5;
      
      targetScale.set(scale, scale, scale);
      meshRef.current.scale.lerp(targetScale, 0.1);
    }
  });

  return (
    <group 
      onClick={onClick}
      onPointerOver={() => document.body.style.cursor = 'pointer'} 
      onPointerOut={() => document.body.style.cursor = 'auto'}
    >
      <Octahedron ref={meshRef} args={[1.2, 0]}>
        <meshStandardMaterial 
          color="#0a0a0c" 
          metalness={0.9} 
          roughness={0.1} 
          envMapIntensity={2}
        />
        <Edges 
          linewidth={2} 
          threshold={15} 
          color={hoveredNode ? "#ffffff" : "#444444"} 
        />
      </Octahedron>
    </group>
  );
}
