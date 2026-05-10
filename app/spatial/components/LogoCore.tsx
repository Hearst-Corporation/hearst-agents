// lint-visual-disable-file
"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { MeshTransmissionMaterial, Sphere, Ring } from "@react-three/drei";

interface LogoCoreProps {
  stage: "idle" | "focus" | "mission" | "asset";
  hoveredNode: string | null;
  onClick: () => void;
}

export function LogoCore({ stage, hoveredNode, onClick }: LogoCoreProps) {
  const groupRef = useRef<THREE.Group>(null);
  const outerRef = useRef<THREE.Mesh>(null);
  const ringMaterialRef = useRef<THREE.MeshStandardMaterial>(null);

  // Animation target values
  const targetScale = useMemo(() => new THREE.Vector3(1, 1, 1), []);
  const targetEmissiveIntensity = useRef(1);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();

    // Breathing effect
    const breath = Math.sin(time * 2) * 0.05;
    
    if (groupRef.current) {
      groupRef.current.scale.lerp(targetScale.clone().addScalar(breath), 0.1);
    }
    
    if (outerRef.current) {
      // Subtle rotation for the glass shell
      outerRef.current.rotation.y = time * 0.1;
      outerRef.current.rotation.x = time * 0.05;
      
      // If a node is hovered, the glass reacts by spinning slightly faster
      if (hoveredNode) {
        outerRef.current.rotation.y += 0.01;
      }
    }

    // Stage based animations
    let targetIntensity = 1;
    switch (stage) {
      case "idle":
        targetScale.set(1, 1, 1);
        targetIntensity = 1 + Math.sin(time * 1.5) * 0.5; // Pulsing glow
        break;
      case "focus":
        targetScale.set(1.2, 1.2, 1.2);
        targetIntensity = 3; // Bright glow
        break;
      case "mission":
        targetScale.set(0.8, 0.8, 0.8);
        targetIntensity = 0.5; // Dimmed
        break;
      case "asset":
        targetScale.set(0.6, 0.6, 0.6);
        targetIntensity = 0.2; // Very dim
        break;
    }

    // Node hover reactions (keep intensity glow, but stay white)
    if (hoveredNode) {
      targetIntensity = 4;
    }

    targetEmissiveIntensity.current = THREE.MathUtils.lerp(targetEmissiveIntensity.current, targetIntensity, 0.1);

    // Update Ring Material
    if (ringMaterialRef.current) {
      ringMaterialRef.current.emissiveIntensity = targetEmissiveIntensity.current * 0.5;
    }
  });

  return (
    <group 
      ref={groupRef} 
      onClick={onClick} 
      onPointerOver={() => document.body.style.cursor = 'pointer'} 
      onPointerOut={() => document.body.style.cursor = 'auto'}
    >
      {/* Inner Core — donne du corps au noyau, reculé par rapport au glass
         pour éviter les rebonds de transmission qui cassaient la silhouette. */}
      <Sphere args={[0.95, 64, 64]}>
        <meshStandardMaterial
          color="#0a0a0c"
          roughness={0.55}
          metalness={0.1}
        />
      </Sphere>

      {/* Outer Glass Shell — vraie sphère, transmission propre. */}
      <Sphere ref={outerRef} args={[1.5, 96, 96]}>
        <MeshTransmissionMaterial
          samples={16}
          thickness={0.25}
          chromaticAberration={hoveredNode ? 0.04 : 0.02}
          anisotropy={0.05}
          distortion={hoveredNode ? 0.08 : 0.04}
          distortionScale={0.15}
          temporalDistortion={0}
          ior={1.25}
          clearcoat={1}
          clearcoatRoughness={0}
          attenuationDistance={2}
          attenuationColor="#ffffff"
          color="#ffffff"
        />
      </Sphere>

      {/* Glowing Ring */}
      <Ring args={[1.1, 1.12, 64]} position={[0, 0, 0]}>
        <meshStandardMaterial
          ref={ringMaterialRef}
          color="#ffffff"
          emissive="#ffffff"
          emissiveIntensity={1}
          transparent
          opacity={0.8}
          side={THREE.DoubleSide}
        />
      </Ring>
    </group>
  );
}
