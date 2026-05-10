// lint-visual-disable-file
"use client";

import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { SpatialStage } from "@/lib/spatial/types";
import { ORB_RADIUS } from "@/lib/spatial/constants";
import { useSpatialMouseContext } from "@/providers/spatial/SpatialMouseProvider";

interface SpatialOrbCoreProps {
  stage: SpatialStage;
  hovered?: boolean;
  onClick?: () => void;
  logoSrc?: string;
}

interface StageVisual {
  scale: number;
  rimGain: number;
  attractionStrength: number;
}

const STAGE_VISUALS: Record<SpatialStage, StageVisual> = {
  idle:       { scale: 1.00, rimGain: 1.00, attractionStrength: 0.0 },
  focus:      { scale: 1.06, rimGain: 1.10, attractionStrength: 0.14 },
  mission:    { scale: 0.78, rimGain: 0.55, attractionStrength: 0.04 },
  asset:      { scale: 0.55, rimGain: 0.40, attractionStrength: 0.0 },
  expert:     { scale: 0.45, rimGain: 0.35, attractionStrength: 0.0 },
  transition: { scale: 0.92, rimGain: 0.85, attractionStrength: 0.0 },
};

const RIM_BASE_OPACITY = 0.9;
const LOGO_OPACITY = 0.8;

/**
 * Charge un SVG en CanvasTexture WebGL.
 */
function useSvgTexture(src: string, size = 512): THREE.Texture | null {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    let cancelled = false;
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const ratio = img.width / img.height;
      let w = size, h = size;
      if (ratio > 1) h = size / ratio;
      else w = size * ratio;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      tex.needsUpdate = true;
      setTexture(tex);
    };
    img.src = src;
    return () => { cancelled = true; };
  }, [src, size]);

  return texture;
}

/**
 * SpatialOrbCore — vrai objet optique simple.
 *
 * Pipeline (3 meshes, sans renderOrder explicite, sans depth hacks) :
 *   1. Logo plane WebGL (interne, légèrement reculé)
 *   2. Rim interne très fin (sphère un peu plus petite que la lentille)
 *   3. Lentille glass principale (transmission 1.0, atténuation lumineuse)
 *
 * Three.js trie naturellement les transparents par profondeur :
 * la lentille est rendue en dernier (plus loin de la caméra dans le buffer alpha)
 * et la transmission lit le framebuffer derrière.
 *
 * Animation :
 *   - léger breathing scale (sin lent)
 *   - léger lerp position vers la souris
 *   - PAS de Float (qui se battait avec le lerp souris)
 */
export function SpatialOrbCore({
  stage,
  hovered = false,
  onClick,
  logoSrc = "/hearst-mark-h.svg",
}: SpatialOrbCoreProps) {
  const groupRef = useRef<THREE.Group>(null);
  const rimMatRef = useRef<THREE.MeshBasicMaterial>(null);

  const { smoothX, smoothY } = useSpatialMouseContext();
  const logoTexture = useSvgTexture(logoSrc, 512);

  const live = useRef({ scale: 1, rim: 1, attraction: 0 });

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const target = STAGE_VISUALS[stage];

    const hoverGain = hovered ? (stage === "idle" ? 1.20 : 1.10) : 1;

    const k = 0.06;
    live.current.scale      = THREE.MathUtils.lerp(live.current.scale, target.scale, k);
    live.current.rim        = THREE.MathUtils.lerp(live.current.rim, target.rimGain * hoverGain, k);
    live.current.attraction = THREE.MathUtils.lerp(live.current.attraction, target.attractionStrength, k);

    // Breathing très discret
    const breathAmp = stage === "idle" ? 0.012 : 0.006;
    const breath = Math.sin(t * 0.9) * breathAmp;

    if (groupRef.current) {
      const s = live.current.scale + breath;
      groupRef.current.scale.set(s, s, s);

      // Lerp position souris (seul système d'animation horizontale/verticale)
      const a = live.current.attraction;
      groupRef.current.position.x = THREE.MathUtils.lerp(
        groupRef.current.position.x, smoothX.get() * a * 1.2, 0.06
      );
      groupRef.current.position.y = THREE.MathUtils.lerp(
        groupRef.current.position.y, -smoothY.get() * a * 1.2, 0.06
      );
    }

    if (rimMatRef.current) {
      rimMatRef.current.opacity = RIM_BASE_OPACITY * live.current.rim;
    }
  });

  const r = ORB_RADIUS.outer;

  return (
    <group
      ref={groupRef}
      onClick={onClick}
      onPointerOver={() => { document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { document.body.style.cursor = "auto"; }}
    >
      {/* === COUCHE 1 : LOGO INTERNE (WebGL plane) ===
          Position légèrement en arrière du centre → rentre dans le volume,
          vu à travers la lentille (réfraction naturelle). */}
      {logoTexture && (
        <mesh position={[0, 0, -r * 0.2]}>
          <planeGeometry args={[r * 0.95, r * 0.95]} />
          <meshBasicMaterial
            map={logoTexture}
            transparent
            opacity={LOGO_OPACITY}
            toneMapped={false}
          />
        </mesh>
      )}

      {/* === COUCHE 2 : RIM INTERNE ===
          Sphère LÉGÈREMENT PLUS PETITE que la lentille (0.985), FrontSide.
          Ne fait PAS de masque noir : juste une fine peau lumineuse qui passe
          à travers la transmission de la lentille principale. */}
      <mesh>
        <sphereGeometry args={[r * 0.985, 64, 64]} />
        <meshBasicMaterial
          ref={rimMatRef}
          color="#ffffff"
          transparent
          opacity={RIM_BASE_OPACITY}
          side={THREE.FrontSide}
        />
      </mesh>

      {/* === COUCHE 3 : LENTILLE GLASS PRINCIPALE ===
          MeshPhysicalMaterial avec transmission 1.0, atténuation BLANC FROID
          (le verre ne tue plus la lumière). Pas de transparent: true ici —
          la transmission gère seule la transparence interne. */}
      <mesh>
        <sphereGeometry args={[r, 64, 64]} />
        <meshPhysicalMaterial
          color="#ffffff"
          transmission={1.0}
          thickness={0.8}
          roughness={0.05}
          metalness={0}
          ior={1.42}
          attenuationColor="#f3f6fb"
          attenuationDistance={8}
          clearcoat={1}
          clearcoatRoughness={0.03}
        />
      </mesh>
    </group>
  );
}
