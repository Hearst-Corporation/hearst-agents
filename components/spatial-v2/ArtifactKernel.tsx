// lint-visual-disable-file
"use client";

import { useMemo, useRef } from "react";
import { useFrame, useLoader, useThree } from "@react-three/fiber";
import * as THREE from "three";

const MARK_SVG = encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 210 190">
  <g fill="#ffffff" transform="translate(0,190) scale(0.1,-0.1)">
    <path d="M0 975 l0 -925 190 0 190 0 0 385 c0 212 3 385 8 385 4 0 95 -86 202 -190 l195 -189 208 -1 c119 0 207 4 207 9 0 5 -4 11 -9 13 -5 2 -132 123 -282 269 -151 146 -331 321 -401 389 l-128 123 0 328 0 329 -190 0 -190 0 0 -925z"/>
    <path d="M1298 1505 l-3 -395 -180 174 -180 175 -208 0 c-115 1 -207 -2 -205 -6 3 -8 437 -430 664 -646 l114 -109 0 -324 0 -324 190 0 190 0 0 925 0 925 -190 0 -190 0 -2 -395z"/>
  </g>
</svg>
`);

const DEFAULT_MARK_SRC = `data:image/svg+xml;charset=utf-8,${MARK_SVG}`;

function lensShape(width: number, height: number, radius: number) {
  const x = -width / 2;
  const y = -height / 2;
  const shape = new THREE.Shape();

  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius);
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);

  return shape;
}

function lensPath(width: number, height: number, radius: number) {
  const path = new THREE.Path();
  path.setFromPoints(lensShape(width, height, radius).getPoints(72).reverse());
  path.closePath();
  return path;
}

export function ArtifactKernel() {
  const rootRef = useRef<THREE.Group>(null);
  const rimRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const logoRef = useRef<THREE.MeshBasicMaterial>(null);
  const { viewport, pointer } = useThree();
  const logoTexture = useLoader(THREE.TextureLoader, DEFAULT_MARK_SRC);
  
  const baseScale = viewport.width < 2 ? 0.74 : 1.15;

  const bodyGeometry = useMemo(() => {
    const geometry = new THREE.ExtrudeGeometry(lensShape(0.86, 0.56, 0.17), {
      depth: 0.28, // Plus lourd, plus profond
      bevelEnabled: true,
      bevelSize: 0.09, // Biseau plus large pour capter la lumière sur une plus grande surface
      bevelThickness: 0.08, // Adoucit fortement la pente
      bevelSegments: 48, // Hyper lisse
      curveSegments: 64, // Précision maximale
    });
    geometry.center();
    return geometry;
  }, []);

  const rimGeometry = useMemo(() => {
    const shape = lensShape(0.91, 0.61, 0.19);
    shape.holes.push(lensPath(0.90, 0.60, 0.185));
    return new THREE.ShapeGeometry(shape, 96);
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const breath = 1 + Math.sin(t * 0.62) * 0.005;

    if (rootRef.current) {
      const driftX = pointer.x * 0.08;
      const driftY = pointer.y * 0.08;
      
      rootRef.current.position.x = THREE.MathUtils.lerp(rootRef.current.position.x, driftX, 0.08);
      rootRef.current.position.y = THREE.MathUtils.lerp(rootRef.current.position.y, driftY, 0.08);
      
      rootRef.current.rotation.y = THREE.MathUtils.lerp(
        rootRef.current.rotation.y,
        pointer.x * 0.2 + Math.sin(t * 0.2) * 0.02,
        0.06
      );
      rootRef.current.rotation.x = THREE.MathUtils.lerp(
        rootRef.current.rotation.x,
        -pointer.y * 0.2 + Math.sin(t * 0.16 + 1.3) * 0.014,
        0.06
      );
      const s = baseScale * breath;
      rootRef.current.scale.set(s, s, s);
    }

    if (rimRef.current) {
      // Effet de respiration énergétique sur le rebord
      const intensity = 0.6 + Math.sin(t * 1.5) * 0.4;
      rimRef.current.emissiveIntensity = intensity;
    }

    if (logoRef.current) {
      logoRef.current.opacity = 0.85 + Math.sin(t * 0.45 + 0.9) * 0.05;
    }
  });

  return (
    <group ref={rootRef}>
      <mesh geometry={bodyGeometry}>
        {/* Retour au MeshPhysicalMaterial, de l'obsidienne pure et nette. */}
        <meshPhysicalMaterial
          color="#08080a"
          transmission={0.9}
          transparent
          opacity={0.95}
          roughness={0.1}
          thickness={1.4}
          ior={1.5}
          clearcoat={1}
          clearcoatRoughness={0.0}
          attenuationColor="#ffffff"
          attenuationDistance={8}
          envMapIntensity={4.5}
          metalness={0.1}
          depthWrite={false}
        />
      </mesh>

      <mesh position={[0.01, 0, 0.174]}>
        <planeGeometry args={[0.272, 0.245]} />
        <meshBasicMaterial
          ref={logoRef}
          map={logoTexture}
          transparent
          opacity={0.85}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>

      <mesh geometry={rimGeometry} position={[0, 0, 0.182]}>
        <meshPhysicalMaterial
          ref={rimRef}
          color="#ffffff"
          emissive="#e2e8f0" // Glow blanc/argent très subtil
          emissiveIntensity={0.5} // Animé dans useFrame
          transparent
          opacity={0.9}
          roughness={0.05}
          metalness={0.9}
          clearcoat={1}
          envMapIntensity={4}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
