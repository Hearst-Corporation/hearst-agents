// lint-visual-disable-file
"use client";

import { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Sphere } from "@react-three/drei";
import { useOrbitalPosition } from "@/hooks/spatial-safe/useSpatialR3F";

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

interface OrbitalParticleMaterial extends THREE.MeshStandardMaterial {
  userData: {
    baseOpacity?: number;
  };
}

function OrbitalParticle({
  config,
  onMaterialMount,
}: {
  config: OrbitalParticleConfig;
  onMaterialMount: (mat: THREE.MeshStandardMaterial) => void;
}) {
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
        ref={(mat) => {
          if (mat) onMaterialMount(mat);
        }}
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
  const materialRefs = useRef<OrbitalParticleMaterial[]>([]);

  // Initialize baseOpacity once on mount
  useEffect(() => {
    materialRefs.current.forEach((mat) => {
      if (mat && "opacity" in mat && mat.userData.baseOpacity === undefined) {
        mat.userData.baseOpacity = mat.opacity ?? 1;
      }
    });
  }, []);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime();
    groupRef.current.rotation.y = t * 0.06;
    groupRef.current.rotation.x = tilt + Math.sin(t * 0.1) * 0.04;

    liveOpacity.current = THREE.MathUtils.lerp(liveOpacity.current, opacity, 0.04);

    // O(1) update — no traverse
    materialRefs.current.forEach((mat) => {
      if (mat && "opacity" in mat) {
        mat.opacity = (mat.userData.baseOpacity ?? 1) * liveOpacity.current;
      }
    });
  });

  const handleMaterialMount = (mat: THREE.MeshStandardMaterial) => {
    if (!materialRefs.current.includes(mat as OrbitalParticleMaterial)) {
      materialRefs.current.push(mat as OrbitalParticleMaterial);
      // Set base opacity immediately on first mount
      if ("opacity" in mat && mat.userData.baseOpacity === undefined) {
        (mat as OrbitalParticleMaterial).userData.baseOpacity = mat.opacity ?? 1;
      }
    }
  };

  return (
    <group ref={groupRef}>
      {particles.map((config, i) => (
        <OrbitalParticle
          key={i}
          config={config}
          onMaterialMount={handleMaterialMount}
        />
      ))}
    </group>
  );
}
