// lint-visual-disable-file
"use client";

import { useRef } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import type { SpatialStage } from "@/lib/spatial/types";

interface OrbMinimalProps {
  stage: SpatialStage;
  hovered?: boolean;
  onClick?: () => void;
  logoSrc?: string;
}

const MARK_SVG = encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 210 190">
  <g fill="#ffffff" transform="translate(0,190) scale(0.1,-0.1)">
    <path d="M0 975 l0 -925 190 0 190 0 0 385 c0 212 3 385 8 385 4 0 95 -86 202 -190 l195 -189 208 -1 c119 0 207 4 207 9 0 5 -4 11 -9 13 -5 2 -132 123 -282 269 -151 146 -331 321 -401 389 l-128 123 0 328 0 329 -190 0 -190 0 0 -925z"/>
    <path d="M1298 1505 l-3 -395 -180 174 -180 175 -208 0 c-115 1 -207 -2 -205 -6 3 -8 437 -430 664 -646 l114 -109 0 -324 0 -324 190 0 190 0 0 925 0 925 -190 0 -190 0 -2 -395z"/>
  </g>
</svg>
`);

const DEFAULT_MARK_SRC = `data:image/svg+xml;charset=utf-8,${MARK_SVG}`;
const RADIUS = 1.5;
const BREATH_AMPLITUDE = 0.004;

const STAGE_SCALE: Record<SpatialStage, number> = {
  idle: 1,
  focus: 1,
  mission: 0.78,
  asset: 0.55,
  expert: 0.45,
  transition: 0.92,
};

export function OrbMinimal({
  stage,
  onClick,
  logoSrc = DEFAULT_MARK_SRC,
}: OrbMinimalProps) {
  const groupRef = useRef<THREE.Group>(null);
  const markTexture = useLoader(THREE.TextureLoader, logoSrc);
  const scale = STAGE_SCALE[stage];

  useFrame((state) => {
    if (!groupRef.current) return;
    const breath = 1 + Math.sin(state.clock.elapsedTime * 0.65) * BREATH_AMPLITUDE;
    const s = scale * breath;
    groupRef.current.scale.set(s, s, s);
  });

  return (
    <group
      ref={groupRef}
      onClick={onClick}
      onPointerOver={() => {
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "auto";
      }}
    >
      <mesh position={[0, 0, RADIUS + 0.018]}>
        <planeGeometry args={[0.58, 0.52]} />
        <meshBasicMaterial
          map={markTexture}
          transparent
          opacity={0.82}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>

      <mesh position={[0, 0, RADIUS + 0.012]}>
        <ringGeometry args={[RADIUS * 0.988, RADIUS * 0.996, 160]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.84}
          toneMapped={false}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh>
        <sphereGeometry args={[RADIUS, 64, 64]} />
        <meshPhysicalMaterial
          color="#050505"
          transmission={1}
          roughness={0.04}
          thickness={1.2}
          ior={1.4}
          clearcoat={1}
          clearcoatRoughness={0.02}
          attenuationColor="#f3f6fb"
          attenuationDistance={10}
          metalness={0}
        />
      </mesh>
    </group>
  );
}
