// lint-visual-disable-file
"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Sphere } from "@react-three/drei";
import { useOrbitalPosition } from "@/hooks/spatial/useSpatialR3F";

interface OrbitalParticleConfig {
  radiusX: number;
  radiusZ: number;
  speed: number;
  phase: number;
  size: number;
  verticalAmplitude?: number;
  opacity?: number;
}

interface OrbitalRingProps {
  particles?: OrbitalParticleConfig[];
  /** Opacité globale du système (0-1) — utilisée pour fade in/out */
  opacity?: number;
  /** Tilt du plan orbital (rad) */
  tilt?: number;
}

/**
 * Trois agents discrets — de simples billes métalliques nettes.
 * Aucune traînée sci-fi, juste une présence silencieuse.
 */
const DEFAULT_PARTICLES: OrbitalParticleConfig[] = [
  { radiusX: 3.0, radiusZ: 2.6, speed: 0.32, phase: 0,                  size: 0.060, opacity: 0.95, verticalAmplitude: 0.25 },
  { radiusX: 4.2, radiusZ: 3.6, speed: 0.22, phase: Math.PI * 0.66,     size: 0.048, opacity: 0.85, verticalAmplitude: 0.45 },
  { radiusX: 3.6, radiusZ: 4.0, speed: 0.42, phase: Math.PI * 1.33,     size: 0.054, opacity: 0.90, verticalAmplitude: 0.30 },
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
    <Sphere ref={ref} args={[config.size, 32, 32]}>
      <meshStandardMaterial
        color="#ffffff"
        roughness={0.1}
        metalness={0.8}
        transparent
        opacity={config.opacity ?? 0.8}
      />
    </Sphere>
  );
}

export function OrbitalRing({
  particles = DEFAULT_PARTICLES,
  opacity = 1,
  tilt = 0.18,
}: OrbitalRingProps) {
  const groupRef = useRef<THREE.Group>(null);
  const liveOpacity = useRef(0);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime();
    groupRef.current.rotation.y = t * 0.06;
    groupRef.current.rotation.x = tilt + Math.sin(t * 0.1) * 0.04;

    liveOpacity.current = THREE.MathUtils.lerp(liveOpacity.current, opacity, 0.04);
    groupRef.current.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.material) {
        const mat = obj.material as THREE.Material & { opacity?: number; transparent?: boolean };
        if (mat.transparent !== undefined) {
          mat.transparent = true;
          if ("opacity" in mat) {
            mat.opacity = (mat.userData.baseOpacity ?? mat.opacity ?? 1) * liveOpacity.current;
            if (mat.userData.baseOpacity === undefined) {
              mat.userData.baseOpacity = mat.opacity;
            }
          }
        }
      }
    });
  });

  return (
    <group ref={groupRef}>
      {particles.map((config, i) => (
        <OrbitalParticle key={i} config={config} />
      ))}
    </group>
  );
}
