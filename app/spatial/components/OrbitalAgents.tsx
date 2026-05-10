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
    emissiveIntensity={1}
    transparent
    opacity={0.8}
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
      groupRef.current.rotation.y = time * 0.5;
      groupRef.current.rotation.z = Math.sin(time * 0.2) * 0.2;
    }

    if (agent1Ref.current) {
      const speed = 1.2;
      const radiusX = 3.2;
      const radiusZ = 2.8;
      agent1Ref.current.position.x = Math.cos(time * speed) * radiusX;
      agent1Ref.current.position.z = Math.sin(time * speed) * radiusZ;
      agent1Ref.current.position.y = Math.sin(time * 1.5) * 0.4;
    }
    
    if (agent2Ref.current) {
      const speed = 0.8;
      const radiusX = 4.5;
      const radiusZ = 3.8;
      const offset = Math.PI * 0.66;
      agent2Ref.current.position.x = Math.cos(time * speed + offset) * radiusX;
      agent2Ref.current.position.z = Math.sin(time * speed + offset) * radiusZ;
      agent2Ref.current.position.y = Math.cos(time * 1.2) * 0.8;
    }

    if (agent3Ref.current) {
      const speed = 1.5;
      const radiusX = 3.8;
      const radiusZ = 4.2;
      const offset = Math.PI * 1.33;
      agent3Ref.current.position.x = Math.cos(time * speed + offset) * radiusX;
      agent3Ref.current.position.z = Math.sin(time * speed + offset) * radiusZ;
      agent3Ref.current.position.y = Math.sin(time * 2.2) * 0.6;
    }
  });

  return (
    <group ref={groupRef}>
      <Trail width={0.4} length={5} color={new THREE.Color(1.5, 1.5, 1.5)} attenuation={(t) => t * t}>
        <Sphere ref={agent1Ref} args={[0.08, 32, 32]}>
          <AgentMaterial />
        </Sphere>
      </Trail>
      
      <Trail width={0.2} length={8} color={new THREE.Color(1, 1, 1)} attenuation={(t) => t * t}>
        <Sphere ref={agent2Ref} args={[0.05, 32, 32]}>
          <AgentMaterial />
        </Sphere>
      </Trail>

      <Trail width={0.3} length={6} color={new THREE.Color(1.2, 1.2, 1.2)} attenuation={(t) => t * t}>
        <Sphere ref={agent3Ref} args={[0.06, 32, 32]}>
          <AgentMaterial />
        </Sphere>
      </Trail>
    </group>
  );
}
