// lint-visual-disable-file
"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { MeshTransmissionMaterial, Sphere, Ring, Html, Billboard } from "@react-three/drei";

interface LogoCoreProps {
  stage: "idle" | "focus" | "mission" | "asset";
  hoveredNode: string | null;
  onClick: () => void;
}

export function LogoCore({ stage, hoveredNode, onClick }: LogoCoreProps) {
  const groupRef = useRef<THREE.Group>(null);
  const outerRef = useRef<THREE.Mesh>(null);
  const htmlContainerRef = useRef<HTMLDivElement>(null);
  
  // Materials for the peripheral energy
  const haloBaseRef = useRef<THREE.MeshBasicMaterial>(null);
  const haloMaterial1Ref = useRef<THREE.MeshBasicMaterial>(null);
  const haloMaterial2Ref = useRef<THREE.MeshBasicMaterial>(null);

  // Animation target values
  const targetScale = useMemo(() => new THREE.Vector3(1, 1, 1), []);
  const glowIntensity = useRef(0.5);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();

    // Slower, calmer breathing
    const breath = Math.sin(time * 1.2) * 0.015;
    
    if (groupRef.current) {
      groupRef.current.scale.lerp(targetScale.clone().addScalar(breath), 0.05);
    }
    
    if (outerRef.current) {
      // Extremely subtle glass rotation (frozen water feeling)
      outerRef.current.rotation.y = time * 0.02;
      outerRef.current.rotation.x = time * 0.01;
      
      if (hoveredNode) {
        outerRef.current.rotation.y += 0.005;
      }
    }

    // Stage based animations
    let targetIntensity = 0.5;
    switch (stage) {
      case "idle":
        targetScale.set(1, 1, 1);
        targetIntensity = 0.6 + Math.sin(time * 0.8) * 0.2;
        break;
      case "focus":
        targetScale.set(1.05, 1.05, 1.05);
        targetIntensity = 1.0;
        break;
      case "mission":
        targetScale.set(0.9, 0.9, 0.9);
        targetIntensity = 0.3;
        break;
      case "asset":
        targetScale.set(0.8, 0.8, 0.8);
        targetIntensity = 0.15;
        break;
    }

    if (hoveredNode) {
      targetIntensity = 1.2;
    }

    glowIntensity.current = THREE.MathUtils.lerp(glowIntensity.current, targetIntensity, 0.05);

    // Animate peripheral energy rings (calm center, living edge)
    if (haloBaseRef.current) {
      haloBaseRef.current.opacity = 0.25 * glowIntensity.current;
    }
    if (haloMaterial1Ref.current) {
      haloMaterial1Ref.current.opacity = (0.15 + Math.sin(time * 2.5) * 0.05) * glowIntensity.current;
    }
    if (haloMaterial2Ref.current) {
      haloMaterial2Ref.current.opacity = (0.05 + Math.cos(time * 1.5) * 0.02) * glowIntensity.current;
    }

    if (htmlContainerRef.current) {
      const currentScale = groupRef.current ? groupRef.current.scale.x : 1;
      htmlContainerRef.current.style.transform = `scale(${currentScale})`;
      
      const glow = glowIntensity.current;
      // Cleaner, sharper drop shadow for pure legibility
      htmlContainerRef.current.style.filter = `drop-shadow(0 0 ${glow * 10}px rgba(255,255,255,1))`;
      htmlContainerRef.current.style.opacity = `${Math.min(1, glow * 0.6 + 0.5)}`;
    }
  });

  return (
    <group 
      ref={groupRef} 
      onClick={onClick} 
      onPointerOver={() => document.body.style.cursor = 'pointer'} 
      onPointerOut={() => document.body.style.cursor = 'auto'}
    >
      {/* 
        Peripheral Magnetic Energy
        Using Billboard to keep the aura perfectly circular on the 2D plane.
        Positioned slightly backward (-0.05) so the inner part of these rings 
        is refracted by the glass, creating a beautiful "internal halo" effect 
        strictly on the rim, leaving the center perfectly calm and black.
      */}
      <Billboard position={[0, 0, -0.05]}>
        {/* Core Rim - sharp, refracted inside the edge */}
        <Ring args={[1.36, 1.40, 128]}>
          <meshBasicMaterial
            ref={haloBaseRef}
            color="#ffffff"
            transparent
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </Ring>
        
        {/* Living Edge Aura 1 - pulsing gently */}
        <Ring args={[1.39, 1.43, 128]}>
          <meshBasicMaterial
            ref={haloMaterial1Ref}
            color="#ffffff"
            transparent
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </Ring>

        {/* Living Edge Aura 2 - dissipating magnetic field */}
        <Ring args={[1.41, 1.46, 128]}>
          <meshBasicMaterial
            ref={haloMaterial2Ref}
            color="#ffffff"
            transparent
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </Ring>
      </Billboard>

      {/* 
        Outer Glass Shell — Frozen liquid lens, no inner opaque core.
        This allows the pure black background to show through, creating 
        a deep, premium crystal appearance.
      */}
      <Sphere ref={outerRef} args={[1.4, 128, 128]}>
        <MeshTransmissionMaterial
          backside={true}
          backsideThickness={1}
          samples={16}
          resolution={1024}
          transmission={1}
          thickness={1.2}
          roughness={0.25} // Frozen/frosted interior finish
          chromaticAberration={0.01} // Ultra minimal, no cheap rainbow
          anisotropy={0.1}
          distortion={0.05} // Very subtle frozen water imperfection
          distortionScale={0.1}
          temporalDistortion={0.02} // Almost imperceptible flow
          ior={1.33} // Water/Ice refraction
          clearcoat={1} // Wet/polished outer shell
          clearcoatRoughness={0.02} // Sharp specular reflections
          attenuationDistance={10} // No heavy darkening
          attenuationColor="#ffffff"
          color="#ffffff"
        />
      </Sphere>

      {/* HTML Logo - Perfectly centered, highly legible against the dark crystal */}
      <Html center pointerEvents="none" zIndexRange={[100, 0]}>
        <div ref={htmlContainerRef} className="flex items-center justify-center will-change-transform transition-opacity duration-1000">
          <div 
            style={{
              width: "110px",
              height: "120px",
              backgroundColor: "#ffffff",
              maskImage: `url('/hearst-dot-h.svg')`,
              maskSize: "contain",
              maskRepeat: "no-repeat",
              maskPosition: "center",
              WebkitMaskImage: `url('/hearst-dot-h.svg')`,
              WebkitMaskSize: "contain",
              WebkitMaskRepeat: "no-repeat",
              WebkitMaskPosition: "center",
            }}
          />
        </div>
      </Html>
    </group>
  );
}
