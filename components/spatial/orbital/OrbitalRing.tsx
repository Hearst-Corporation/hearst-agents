// lint-visual-disable-file
"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Sphere, Trail } from "@react-three/drei";
import { useOrbitalPosition, useSlowRotation } from "@/hooks/spatial/useSpatialR3F";

interface OrbitalParticleConfig {
  radiusX: number;
  radiusZ: number;
  speed: number;
  phase: number;
  size: number;
  trailWidth: number;
  trailLength: number;
  verticalAmplitude?: number;
}

interface OrbitalRingProps {
  particles?: OrbitalParticleConfig[];
}

const DEFAULT_PARTICLES: OrbitalParticleConfig[] = [
  { radiusX: 3.2, radiusZ: 2.8, speed: 1.2, phase: 0, size: 0.08, trailWidth: 0.4, trailLength: 5 },
  { radiusX: 4.5, radiusZ: 3.8, speed: 0.8, phase: Math.PI * 0.66, size: 0.05, trailWidth: 0.2, trailLength: 8, verticalAmplitude: 0.8 },
  { radiusX: 3.8, radiusZ: 4.2, speed: 1.5, phase: Math.PI * 1.33, size: 0.06, trailWidth: 0.3, trailLength: 6, verticalAmplitude: 0.6 },
];

function OrbitalParticle({ config }: { config: OrbitalParticleConfig }) {
  const ref = useOrbitalPosition(
    config.radiusX,
    config.radiusZ,
    config.speed,
    config.phase,
    config.verticalAmplitude
  );

  return (
    <Trail
      width={config.trailWidth}
      length={config.trailLength}
      color={new THREE.Color(1.2, 1.2, 1.2)}
      attenuation={(t) => t * t}
    >
      <Sphere ref={ref} args={[config.size, 32, 32]}>
        <meshStandardMaterial
          color="#ffffff"
          emissive="#ffffff"
          emissiveIntensity={1}
          transparent
          opacity={0.8}
        />
      </Sphere>
    </Trail>
  );
}

/**
 * Système d'agents orbitaux 3D — purement décoratif.
 * Particules avec trails autour de l'orbe central.
 */
export function OrbitalRing({ particles = DEFAULT_PARTICLES }: OrbitalRingProps) {
  const groupRef = useSlowRotation(0.5, 0.2);

  return (
    <group ref={groupRef}>
      {particles.map((config, i) => (
        <OrbitalParticle key={i} config={config} />
      ))}
    </group>
  );
}
