"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Sparkles, Sphere } from "@react-three/drei";

interface CoreProps {
  stage: "idle" | "focus" | "mission" | "asset";
  hoveredNode: string | null;
  onClick: () => void;
}

export function ParticleSwarmCore({ stage, hoveredNode, onClick }: CoreProps) {
  const groupRef = useRef<THREE.Group>(null);
  const targetScale = useMemo(() => new THREE.Vector3(1, 1, 1), []);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    if (groupRef.current) {
      groupRef.current.rotation.y = time * 0.1;
      groupRef.current.rotation.x = Math.sin(time * 0.5) * 0.1;
      
      let scale = 1;
      if (stage === "focus") scale = 1.2;
      if (stage === "mission") scale = 0.8;
      if (stage === "asset") scale = 0.6;
      if (hoveredNode) scale += 0.1;
      
      targetScale.set(scale, scale, scale);
      groupRef.current.scale.lerp(targetScale, 0.1);
    }
  });

  return (
    <group 
      ref={groupRef} 
      onClick={onClick}
      onPointerOver={() => document.body.style.cursor = 'pointer'} 
      onPointerOut={() => document.body.style.cursor = 'auto'}
    >
      <Sphere args={[0.8, 32, 32]}>
        <meshBasicMaterial color="#000000" />
      </Sphere>
      <Sparkles 
        count={200} 
        scale={3} 
        size={4} 
        speed={0.4} 
        opacity={hoveredNode ? 1 : 0.6} 
        color={hoveredNode ? "#ffffff" : "#aaaaaa"} 
      />
      <Sparkles 
        count={50} 
        scale={1.5} 
        size={10} 
        speed={1} 
        opacity={0.8} 
        color="#ffffff" 
      />
    </group>
  );
}
