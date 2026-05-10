"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Icosahedron, Sphere } from "@react-three/drei";

interface CoreProps {
  stage: "idle" | "focus" | "mission" | "asset";
  hoveredNode: string | null;
  onClick: () => void;
}

export function WireframeNexusCore({ stage, hoveredNode, onClick }: CoreProps) {
  const outerRef = useRef<THREE.Mesh>(null);
  const innerRef = useRef<THREE.Mesh>(null);
  const targetScale = useMemo(() => new THREE.Vector3(1, 1, 1), []);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    
    if (outerRef.current && innerRef.current) {
      outerRef.current.rotation.y = time * 0.1;
      outerRef.current.rotation.x = time * 0.15;
      
      innerRef.current.rotation.y = -time * 0.2;
      innerRef.current.rotation.z = time * 0.1;
      
      let scale = 1;
      if (stage === "focus") scale = 1.2;
      if (stage === "mission") scale = 0.8;
      if (stage === "asset") scale = 0.6;
      if (hoveredNode) scale += 0.1;
      
      targetScale.set(scale, scale, scale);
      outerRef.current.scale.lerp(targetScale, 0.1);
      innerRef.current.scale.lerp(targetScale, 0.1);
    }
  });

  return (
    <group 
      onClick={onClick}
      onPointerOver={() => document.body.style.cursor = 'pointer'} 
      onPointerOut={() => document.body.style.cursor = 'auto'}
    >
      {/* Inner glowing core */}
      <Sphere ref={innerRef} args={[0.6, 16, 16]}>
        <meshBasicMaterial color={hoveredNode ? "#ffffff" : "#444444"} wireframe />
      </Sphere>
      
      {/* Outer technical shell */}
      <Icosahedron ref={outerRef} args={[1.4, 1]}>
        <meshStandardMaterial 
          color="#ffffff" 
          wireframe 
          transparent 
          opacity={hoveredNode ? 0.8 : 0.3} 
        />
      </Icosahedron>
    </group>
  );
}
