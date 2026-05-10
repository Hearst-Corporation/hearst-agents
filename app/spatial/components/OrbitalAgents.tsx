// lint-visual-disable-file
"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Sphere, Trail } from "@react-three/drei";

const AgentMaterial = () => (
  <meshStandardMaterial
    color="#ffffff"
    emissive="#ffffff"
    emissiveIntensity={0.5}
    transparent
    opacity={0.6}
    roughness={0.2}
  />
);

export function OrbitalAgents() {
  const groupRef = useRef<THREE.Group>(null);
  const agent1Ref = useRef<THREE.Mesh>(null);
  const agent2Ref = useRef<THREE.Mesh>(null);
  const agent3Ref = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    
    if (groupRef.current) {
      groupRef.current.rotation.y = time * 0.1; // Extremely slow global rotation
      groupRef.current.rotation.z = Math.sin(time * 0.05) * 0.1;
    }

    // Slow, elegant orbital mechanics
    if (agent1Ref.current) {
      const speed = 0.2;
      const radiusX = 3.5;
      const radiusZ = 3.0;
      agent1Ref.current.position.x = Math.cos(time * speed) * radiusX;
      agent1Ref.current.position.z = Math.sin(time * speed) * radiusZ;
      agent1Ref.current.position.y = Math.sin(time * 0.3) * 0.4;
    }
    
    if (agent2Ref.current) {
      const speed = 0.15;
      const radiusX = 4.2;
      const radiusZ = 3.8;
      const offset = Math.PI * 0.66;
      agent2Ref.current.position.x = Math.cos(time * speed + offset) * radiusX;
      agent2Ref.current.position.z = Math.sin(time * speed + offset) * radiusZ;
      agent2Ref.current.position.y = Math.cos(time * 0.25) * 0.6;
    }

    if (agent3Ref.current) {
      const speed = 0.25;
      const radiusX = 3.8;
      const radiusZ = 4.2;
      const offset = Math.PI * 1.33;
      agent3Ref.current.position.x = Math.cos(time * speed + offset) * radiusX;
      agent3Ref.current.position.z = Math.sin(time * speed + offset) * radiusZ;
      agent3Ref.current.position.y = Math.sin(time * 0.4) * 0.5;
    }
  });

  return (
    <group ref={groupRef}>
      <Trail width={0.15} length={12} color={new THREE.Color(0.8, 0.8, 0.8)} attenuation={(t) => t * t * t}>
        <Sphere ref={agent1Ref} args={[0.06, 32, 32]}>
          <AgentMaterial />
        </Sphere>
      </Trail>
      
      <Trail width={0.1} length={16} color={new THREE.Color(0.5, 0.5, 0.5)} attenuation={(t) => t * t * t}>
        <Sphere ref={agent2Ref} args={[0.04, 32, 32]}>
          <AgentMaterial />
        </Sphere>
      </Trail>

      <Trail width={0.12} length={14} color={new THREE.Color(0.6, 0.6, 0.6)} attenuation={(t) => t * t * t}>
        <Sphere ref={agent3Ref} args={[0.05, 32, 32]}>
          <AgentMaterial />
        </Sphere>
      </Trail>
    </group>
  );
}
