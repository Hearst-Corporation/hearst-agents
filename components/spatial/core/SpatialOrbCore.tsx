// lint-visual-disable-file
"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { MeshTransmissionMaterial, Sphere, Ring, Float, Html } from "@react-three/drei";
import type { SpatialStage } from "@/lib/spatial/types";
import { ORB_RADIUS } from "@/lib/spatial/constants";

interface SpatialOrbCoreProps {
  stage: SpatialStage;
  hoveredNode?: string | null;
  onClick?: () => void;
  logoSrc?: string;
}

const STAGE_SCALE: Record<SpatialStage, number> = {
  idle: 1,
  focus: 1.2,
  mission: 0.8,
  asset: 0.6,
  expert: 0.5,
  transition: 0.9,
};

/**
 * Orbe central avec shell en verre, anneau lumineux et logo HTML.
 * Séparé de toute logique métier — reçoit le stage et réagit visuellement.
 */
export function SpatialOrbCore({
  stage,
  hoveredNode = null,
  onClick,
  logoSrc = "/hearst-dot-h.svg",
}: SpatialOrbCoreProps) {
  const groupRef = useRef<THREE.Group>(null);
  const outerRef = useRef<THREE.Mesh>(null);
  const ringMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
  const htmlRef = useRef<HTMLDivElement>(null);

  const targetScale = useMemo(() => new THREE.Vector3(1, 1, 1), []);
  const emissiveIntensity = useRef(1);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const breath = Math.sin(t * 2) * 0.05;
    const desired = STAGE_SCALE[stage];

    targetScale.set(desired, desired, desired);

    if (groupRef.current) {
      groupRef.current.scale.lerp(
        targetScale.clone().addScalar(breath),
        0.08
      );
    }

    if (outerRef.current) {
      outerRef.current.rotation.y = t * 0.1 + (hoveredNode ? 0.01 : 0);
      outerRef.current.rotation.x = t * 0.05;
    }

    let targetIntensity = stage === "idle"
      ? 1 + Math.sin(t * 1.5) * 0.5
      : stage === "focus" ? 3
      : stage === "mission" ? 0.5
      : 0.2;

    if (hoveredNode) targetIntensity = 4;

    emissiveIntensity.current = THREE.MathUtils.lerp(
      emissiveIntensity.current,
      targetIntensity,
      0.1
    );

    if (ringMaterialRef.current) {
      ringMaterialRef.current.emissiveIntensity = emissiveIntensity.current * 0.5;
    }

    if (htmlRef.current && groupRef.current) {
      const s = groupRef.current.scale.x;
      htmlRef.current.style.transform = `scale(${s})`;
      htmlRef.current.style.filter = `drop-shadow(0 0 ${emissiveIntensity.current * 4}px #ffffff)`;
    }
  });

  return (
    <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.5}>
      <group
        ref={groupRef}
        onClick={onClick}
        onPointerOver={() => { document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { document.body.style.cursor = "auto"; }}
      >
        {/* Inner core */}
        <Sphere args={[ORB_RADIUS.inner, 64, 64]}>
          <meshStandardMaterial color="#0a0a0c" roughness={0.55} metalness={0.1} />
        </Sphere>

        {/* Glass shell */}
        <Sphere ref={outerRef} args={[ORB_RADIUS.outer, 96, 96]}>
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

        {/* Luminous ring */}
        <Ring args={[ORB_RADIUS.ring.inner, ORB_RADIUS.ring.outer, 64]}>
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

        {/* HTML logo — synchronisé avec le scale 3D */}
        <Html center pointerEvents="none" zIndexRange={[100, 0]}>
          <div ref={htmlRef} className="flex items-center justify-center will-change-transform">
            <div
              style={{
                width: "110px",
                height: "120px",
                backgroundColor: "#ffffff",
                maskImage: `url('${logoSrc}')`,
                maskSize: "contain",
                maskRepeat: "no-repeat",
                maskPosition: "center",
                WebkitMaskImage: `url('${logoSrc}')`,
                WebkitMaskSize: "contain",
                WebkitMaskRepeat: "no-repeat",
                WebkitMaskPosition: "center",
              }}
            />
          </div>
        </Html>
      </group>
    </Float>
  );
}
