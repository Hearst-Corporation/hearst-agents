"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Torus, Sphere } from "@react-three/drei";

interface CoreProps {
  stage: "idle" | "focus" | "mission" | "asset";
  hoveredNode: string | null;
  onClick: () => void;
}

export function AstrolabeCore({ stage, hoveredNode, onClick }: CoreProps) {
  const groupRef = useRef<THREE.Group>(null);
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const ring3Ref = useRef<THREE.Mesh>(null);
  
  const targetScale = useMemo(() => new THREE.Vector3(1, 1, 1), []);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    
    const speedMultiplier = hoveredNode ? 3 : 1;

    if (ring1Ref.current) ring1Ref.current.rotation.x = time * 0.5 * speedMultiplier;
    if (ring2Ref.current) ring2Ref.current.rotation.y = time * 0.3 * speedMultiplier;
    if (ring3Ref.current) ring3Ref.current.rotation.z = time * 0.4 * speedMultiplier;

    if (groupRef.current) {
      let scale = 1;
      if (stage === "focus") scale = 1.2;
      if (stage === "mission") scale = 0.8;
      if (stage === "asset") scale = 0.6;
      
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
      <Sphere args={[0.4, 32, 32]}>
        <meshStandardMaterial color={hoveredNode ? "#ffffff" : "#0a0a0c"} emissive={hoveredNode ? "#ffffff" : "#000000"} emissiveIntensity={0.5} />
      </Sphere>
      
      <Torus ref={ring1Ref} args={[1.2, 0.02, 16, 100]}>
        <meshStandardMaterial color="#ffffff" metalness={0.8} roughness={0.2} />
      </Torus>
      <Torus ref={ring2Ref} args={[1.4, 0.02, 16, 100]} rotation={[Math.PI / 4, 0, 0]}>
        <meshStandardMaterial color="#888888" metalness={0.8} roughness={0.2} />
      </Torus>
      <Torus ref={ring3Ref} args={[1.6, 0.01, 16, 100]} rotation={[0, Math.PI / 4, 0]}>
        <meshStandardMaterial color="#444444" metalness={0.8} roughness={0.2} />
      </Torus>
    </group>
  );
}
