// lint-visual-disable-file
"use client";

import { useMemo, useRef, useState } from "react";
import { useFrame, useLoader, useThree } from "@react-three/fiber";
import { useCursor, Html } from "@react-three/drei";
import * as THREE from "three";
import { useSpatialStore } from "./store";

const MARK_SVG = encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 210 190">
  <g fill="#ffffff" transform="translate(0,190) scale(0.1,-0.1)">
    <path d="M0 975 l0 -925 190 0 190 0 0 385 c0 212 3 385 8 385 4 0 95 -86 202 -190 l195 -189 208 -1 c119 0 207 4 207 9 0 5 -4 11 -9 13 -5 2 -132 123 -282 269 -151 146 -331 321 -401 389 l-128 123 0 328 0 329 -190 0 -190 0 0 -925z"/>
    <path d="M1298 1505 l-3 -395 -180 174 -180 175 -208 0 c-115 1 -207 -2 -205 -6 3 -8 437 -430 664 -646 l114 -109 0 -324 0 -324 190 0 190 0 0 925 0 925 -190 0 -190 0 -2 -395z"/>
  </g>
</svg>
`);

const DEFAULT_MARK_SRC = `data:image/svg+xml;charset=utf-8,${MARK_SVG}`;

// Configuration physique du noyau central
const KERNEL_CONFIG = {
  depth: 0.28,
  bevelSize: 0.09,
  bevelThickness: 0.08,
  bevelSegments: 48,
  curveSegments: 64,
  rimOffsetInner: 0.90,
  rimOffsetOuter: 0.60,
  rimHoleRadius: 0.185,
};

const COLOR_CYAN = new THREE.Color("#7dd3fc");
const COLOR_WHITE = new THREE.Color("#ffffff");

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

// Les "pétales" de l'orchestration qui se déploient au clic
function MechanicalRings() {
  const isExpanded = useSpatialStore((state) => state.isExpanded);
  const ring1Ref = useRef<THREE.Group>(null);
  const ring2Ref = useRef<THREE.Group>(null);
  const mat1Ref = useRef<THREE.MeshBasicMaterial>(null);
  const mat2Ref = useRef<THREE.MeshBasicMaterial>(null);

  useFrame((state, delta) => {
    if (!ring1Ref.current || !ring2Ref.current || !mat1Ref.current || !mat2Ref.current) return;
    
    // Déploiement : L'échelle et l'opacité augmentent quand étendu
    const targetScale = isExpanded ? 1.6 : 0.6;
    const targetOpacity = isExpanded ? 0.35 : 0;
    
    // Amortissement très fluide (horlogerie)
    ring1Ref.current.scale.setScalar(THREE.MathUtils.lerp(ring1Ref.current.scale.x, targetScale, 0.04));
    ring2Ref.current.scale.setScalar(THREE.MathUtils.lerp(ring2Ref.current.scale.x, targetScale * 1.15, 0.03));
    
    // La rotation s'accélère légèrement pendant le déploiement
    const speed = isExpanded ? 0.2 : 0.05;
    ring1Ref.current.rotation.z += speed * delta;
    ring2Ref.current.rotation.z -= (speed * 0.8) * delta;
    
    // Fade in/out de l'opacité direct sur le matériau
    mat1Ref.current.opacity = THREE.MathUtils.lerp(mat1Ref.current.opacity, targetOpacity, 0.05);
    mat2Ref.current.opacity = THREE.MathUtils.lerp(mat2Ref.current.opacity, targetOpacity * 0.6, 0.05);
  });

  return (
    <group position={[0, 0, -0.15]}>
      <group ref={ring1Ref}>
        <mesh>
          <torusGeometry args={[0.8, 0.002, 16, 100, Math.PI * 1.6]} />
          <meshBasicMaterial ref={mat1Ref} color="#ffffff" transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>
      <group ref={ring2Ref} position={[0, 0, -0.05]}>
        <mesh rotation={[0, 0, Math.PI]}>
          <torusGeometry args={[0.9, 0.001, 16, 100, Math.PI * 1.8]} />
          <meshBasicMaterial ref={mat2Ref} color="#ffffff" transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}

const SVGS = {
  critique: encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round">
  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>
</svg>`),
  synthese: encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round">
  <rect x="16" y="16" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="9" y="2" width="6" height="6" rx="1"/><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"/><path d="M12 12V8"/>
</svg>`),
  memoire: encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round">
  <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/>
</svg>`),
  generation: encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round">
  <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1-1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
</svg>`)
};

const AGENT_TEXTURES_SRC = [
  `data:image/svg+xml;charset=utf-8,${SVGS.critique}`,
  `data:image/svg+xml;charset=utf-8,${SVGS.synthese}`,
  `data:image/svg+xml;charset=utf-8,${SVGS.memoire}`,
  `data:image/svg+xml;charset=utf-8,${SVGS.generation}`,
];

// Nœud Agent (Constellation)
function AgentNode({ position, label, texture, themeColor }: { position: [number, number, number]; label: string; texture: THREE.Texture; themeColor: string }) {
  const isExpanded = useSpatialStore((state) => state.isExpanded);
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);
  
  const groupRef = useRef<THREE.Group>(null);
  const gemRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const iconMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const rimMatRef = useRef<THREE.MeshStandardMaterial>(null);

  // Géométrie sur-mesure : Une lentille circulaire biseautée (moitié de la taille du centre)
  const agentGeometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, 0.22, 0, Math.PI * 2, false); // Cercle parfait
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: 0.1,
      bevelEnabled: true,
      bevelSize: 0.04,
      bevelThickness: 0.04,
      bevelSegments: 32,
      curveSegments: 64,
    });
    geometry.center();
    return geometry;
  }, []);

  useFrame((state, delta) => {
    if (!groupRef.current || !gemRef.current || !matRef.current || !iconMatRef.current) return;
    const t = state.clock.elapsedTime;
    
    // Position cinématique : L'agent part exactement du noyau (Z=0.180) et explose vers sa position
    const targetX = isExpanded ? position[0] : 0;
    const targetY = isExpanded ? position[1] : 0;
    const targetZ = isExpanded ? position[2] : 0.180;
    
    // Mouvement très vif ("explosion")
    groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x, targetX, 0.08);
    groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, targetY, 0.08);
    groupRef.current.position.z = THREE.MathUtils.lerp(groupRef.current.position.z, targetZ, 0.08);

    // L'agent grossit (1.0 = taille normale, 1.15 = survol)
    const targetScale = isExpanded ? (hovered ? 1.15 : 1) : 0.001;
    groupRef.current.scale.setScalar(THREE.MathUtils.lerp(groupRef.current.scale.x, targetScale, 0.1));
    
    // Transparence de l'enveloppe (plus basse pour simuler le verre avec le MeshStandardMaterial)
    matRef.current.opacity = THREE.MathUtils.lerp(matRef.current.opacity, isExpanded ? 0.35 : 0, 0.06);

    // Rotation mécanique très lente autour de l'axe Z
    gemRef.current.rotation.z += (hovered ? 0.01 : 0.05) * delta;

    // Le logo interne s'anime avec sa propre couleur et respire
    if (isExpanded) {
      const pulse = Math.sin(t * 3) * 0.2; // Pulse plus nerveux
      const targetIconOpacity = hovered ? 1 : 0.85; 
      // Effet néon très puissant ("résistance qui chauffe")
      const targetEmissive = hovered ? 4.0 : 1.5 + pulse; 
      iconMatRef.current.opacity = THREE.MathUtils.lerp(iconMatRef.current.opacity, targetIconOpacity, 0.1);
      iconMatRef.current.emissiveIntensity = THREE.MathUtils.lerp(iconMatRef.current.emissiveIntensity, targetEmissive, 0.1);

      // Animation du rim incandescent
      if (rimMatRef.current) {
        rimMatRef.current.opacity = THREE.MathUtils.lerp(rimMatRef.current.opacity, hovered ? 1 : 0.6, 0.1);
        rimMatRef.current.emissiveIntensity = THREE.MathUtils.lerp(rimMatRef.current.emissiveIntensity, hovered ? 2.5 : 0.8 + pulse, 0.1);
      }
    } else {
      iconMatRef.current.opacity = THREE.MathUtils.lerp(iconMatRef.current.opacity, 0, 0.3);
      iconMatRef.current.emissiveIntensity = THREE.MathUtils.lerp(iconMatRef.current.emissiveIntensity, 0, 0.3);
      if (rimMatRef.current) {
        rimMatRef.current.opacity = THREE.MathUtils.lerp(rimMatRef.current.opacity, 0, 0.3);
        rimMatRef.current.emissiveIntensity = THREE.MathUtils.lerp(rimMatRef.current.emissiveIntensity, 0, 0.3);
      }
    }
  });

  return (
    <group>
      <group 
        ref={groupRef}
        onPointerOver={(e) => {
          if (isExpanded) {
            e.stopPropagation();
            setHovered(true);
          }
        }}
        onPointerOut={() => setHovered(false)}
      >
        {/* L'enveloppe : Verre standard optimisé */}
        <mesh ref={gemRef} geometry={agentGeometry}>
          <meshStandardMaterial
            ref={matRef}
            color="#ffffff" // Verre très clair
            roughness={0.2} // Aspect givré
            metalness={0.8} // Forte réflexion
            transparent
            opacity={0} // Géré dans le useFrame
            envMapIntensity={8} // Compense l'absence de transmission par de forts reflets
            depthWrite={false}
          />
        </mesh>
        
        {/* Le Rim Incandescent ("Résistance") */}
        <mesh position={[0, 0, 0.06]}>
          <torusGeometry args={[0.2, 0.006, 16, 64]} />
          <meshStandardMaterial
            ref={rimMatRef}
            color="#000000" // La couleur de base est noire, seule l'émission compte
            emissive={themeColor}
            emissiveIntensity={0}
            transparent
            opacity={0}
            toneMapped={false} // Crucial pour l'effet néon pur
            depthWrite={false}
          />
        </mesh>

        {/* Le Cœur : Logo incandescent optimisé */}
        <mesh position={[0, 0, 0.08]}>
          <planeGeometry args={[0.22, 0.22]} />
          <meshStandardMaterial
            ref={iconMatRef}
            map={texture}
            color="#000000" // La couleur de base est noire
            emissive={themeColor} // Lumière propre
            emissiveIntensity={0}
            transparent
            opacity={0}
            roughness={0.5}
            metalness={0.1}
            depthWrite={false}
            side={THREE.DoubleSide}
            toneMapped={false} // Le secret du néon éblouissant
          />
        </mesh>

        {/* Le Label */}
        <Html position={[0, 0.42, 0]} center style={{ pointerEvents: "none" }}>
          <div 
            className="text-[11px] font-light tracking-[0.25em] uppercase whitespace-nowrap transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{ 
              color: themeColor,
              opacity: isExpanded ? (hovered ? 1 : 0.6) : 0,
              transform: isExpanded ? (hovered ? "translateY(0px)" : "translateY(4px)") : "translateY(12px)",
              textShadow: `0 2px 10px ${themeColor}60` 
            }}
          >
            {label}
          </div>
        </Html>
      </group>
    </group>
  );
}

// Constellation d'agents distribuée dynamiquement
function Constellation({ textures }: { textures: THREE.Texture[] }) {
  const isExpanded = useSpatialStore((state) => state.isExpanded);
  const ringMatRef = useRef<THREE.LineBasicMaterial>(null);
  
  // Le grand anneau de la constellation (orbite)
  const ellipseCurve = useMemo(() => {
    const curve = new THREE.EllipseCurve(0, 0, 1.1, 0.75, 0, 2 * Math.PI, false, 0);
    const points = curve.getPoints(128);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    return geometry;
  }, []);

  useFrame(() => {
    if (ringMatRef.current) {
      ringMatRef.current.opacity = THREE.MathUtils.lerp(ringMatRef.current.opacity, isExpanded ? 0.08 : 0, 0.04);
    }
  });

  // Positions en croix (diagonales) "X" autour du noyau
  const agents = [
    { label: "Agent Critique", color: "#fbbf24", pos: [1.1, 0.75, 0.2] as [number, number, number] },
    { label: "Synthèse Globale", color: "#38bdf8", pos: [-1.1, 0.75, 0.2] as [number, number, number] },
    { label: "Mémoire Active", color: "#a78bfa", pos: [-1.1, -0.75, 0.2] as [number, number, number] },
    { label: "Génération", color: "#34d399", pos: [1.1, -0.75, 0.2] as [number, number, number] },
  ];

  return (
    <>
      {/* @ts-expect-error - Conflit de type TS entre <line> R3F et <line> SVG */}
      <line geometry={ellipseCurve} position={[0, 0, 0.2]}>
        <lineBasicMaterial ref={ringMatRef} color="#ffffff" transparent opacity={0} depthWrite={false} />
      </line>

      {agents.map((agent, i) => (
        <AgentNode 
          key={agent.label} 
          label={agent.label} 
          position={agent.pos} 
          texture={textures[i % textures.length]} 
          themeColor={agent.color}
        />
      ))}
    </>
  );
}

export function ArtifactKernel() {
  const isExpanded = useSpatialStore((state) => state.isExpanded);
  const toggleExpanded = useSpatialStore((state) => state.toggleExpanded);
  const rootRef = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Group>(null);
  const rimRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const logoRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const logoMeshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);
  const { viewport, pointer } = useThree();
  const logoTexture = useLoader(THREE.TextureLoader, DEFAULT_MARK_SRC);
  
  // Chargement centralisé des textures (pour éviter le rechargement par chaque agent)
  const agentTextures = useLoader(THREE.TextureLoader, AGENT_TEXTURES_SRC);
  
  // Échelle fluide basée sur le viewport, avec limites (min/max)
  const baseScale = THREE.MathUtils.clamp(viewport.width * 0.18 + 0.5, 0.74, 1.3);

  const bodyGeometry = useMemo(() => {
    const geometry = new THREE.ExtrudeGeometry(lensShape(0.86, 0.56, 0.17), {
      depth: KERNEL_CONFIG.depth,
      bevelEnabled: true,
      bevelSize: KERNEL_CONFIG.bevelSize,
      bevelThickness: KERNEL_CONFIG.bevelThickness,
      bevelSegments: KERNEL_CONFIG.bevelSegments,
      curveSegments: KERNEL_CONFIG.curveSegments,
    });
    geometry.center();
    return geometry;
  }, []);

  const rimGeometry = useMemo(() => {
    const shape = lensShape(0.91, 0.61, 0.19);
    shape.holes.push(lensPath(KERNEL_CONFIG.rimOffsetInner, KERNEL_CONFIG.rimOffsetOuter, KERNEL_CONFIG.rimHoleRadius));
    return new THREE.ShapeGeometry(shape, 96);
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const breath = 1 + Math.sin(t * 0.62) * 0.005;

    if (rootRef.current) {
      // Quand déployé, le noyau se fige parfaitement au centre (pas de dérive)
      const targetDriftX = isExpanded ? 0 : pointer.x * 0.08;
      const targetDriftY = isExpanded ? 0 : pointer.y * 0.08;
      const targetRotY = isExpanded ? 0 : pointer.x * 0.2 + Math.sin(t * 0.2) * 0.02;
      const targetRotX = isExpanded ? 0 : -pointer.y * 0.2 + Math.sin(t * 0.16 + 1.3) * 0.014;
      
      rootRef.current.position.x = THREE.MathUtils.lerp(rootRef.current.position.x, targetDriftX, 0.08);
      rootRef.current.position.y = THREE.MathUtils.lerp(rootRef.current.position.y, targetDriftY, 0.08);
      
      rootRef.current.rotation.y = THREE.MathUtils.lerp(
        rootRef.current.rotation.y,
        targetRotY,
        0.06
      );
      rootRef.current.rotation.x = THREE.MathUtils.lerp(
        rootRef.current.rotation.x,
        targetRotX,
        0.06
      );
      
      // La respiration du scale s'arrête également quand étendu
      const targetScale = isExpanded ? baseScale : baseScale * breath;
      rootRef.current.scale.setScalar(THREE.MathUtils.lerp(rootRef.current.scale.x, targetScale, 0.08));
    }

    if (coreRef.current) {
      // Le cœur reste à sa place (la caméra recule déjà pour l'effet de profondeur)
      const targetCoreZ = isExpanded ? 0 : 0;
      coreRef.current.position.z = THREE.MathUtils.lerp(coreRef.current.position.z, targetCoreZ, 0.04);
    }

    if (rimRef.current) {
      // Respiration plus visible et légèrement plus rapide pour être perçue
      const intensity = 0.5 + Math.sin(t * 1.5) * 0.3;
      rimRef.current.emissiveIntensity = intensity;
      rimRef.current.opacity = 0.85 + Math.sin(t * 1.5) * 0.15;
    }

    if (logoRef.current && logoMeshRef.current) {
      if (isExpanded) {
        // Activité de pulse avec un léger accent de couleur (cyan/glace très subtil)
        logoRef.current.emissive.lerp(COLOR_CYAN, 0.05);
        logoRef.current.emissiveIntensity = THREE.MathUtils.lerp(
          logoRef.current.emissiveIntensity,
          4.0 + Math.sin(t * 3.5) * 2.0, // Flash d'explosion très fort
          0.15
        );
        logoRef.current.opacity = THREE.MathUtils.lerp(
          logoRef.current.opacity,
          0, // Disparaît complètement après l'explosion
          0.05
        );
        logoMeshRef.current.scale.setScalar(THREE.MathUtils.lerp(
          logoMeshRef.current.scale.x,
          2.5, // Grossit fortement
          0.1
        ));
      } else {
        // État dormant : dépoli, très discret
        logoRef.current.emissive.lerp(COLOR_WHITE, 0.05);
        logoRef.current.emissiveIntensity = THREE.MathUtils.lerp(
          logoRef.current.emissiveIntensity,
          0.0,
          0.1
        );
        logoRef.current.opacity = THREE.MathUtils.lerp(
          logoRef.current.opacity,
          0.35 + Math.sin(t * 0.45 + 0.9) * 0.05,
          0.1
        );
        logoMeshRef.current.scale.setScalar(THREE.MathUtils.lerp(
          logoMeshRef.current.scale.x,
          1.0,
          0.1
        ));
      }
    }
  });

  return (
    <group 
      ref={rootRef}
      onClick={(e) => {
        e.stopPropagation();
        toggleExpanded();
      }}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <Constellation textures={agentTextures} />
      <MechanicalRings />

      <group ref={coreRef}>
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

        <mesh ref={logoMeshRef} position={[0.01, 0, 0.180]}>
          <planeGeometry args={[0.272, 0.245]} />
          <meshPhysicalMaterial
            ref={logoRef}
            map={logoTexture}
            color="#ffffff"
            transparent
            opacity={0.35} // Opacité de base (dépoli)
            roughness={0.5} // Aspect dépoli
            metalness={0.1}
            clearcoat={0.2}
            emissive="#ffffff"
            emissiveIntensity={0}
            depthWrite={false}
          />
        </mesh>

        <mesh geometry={rimGeometry} position={[0, 0, 0.190]}>
          <meshPhysicalMaterial
            ref={rimRef}
            color="#ffffff"
            emissive="#ffffff" // Lumière pure
            emissiveIntensity={0.25} // Animé dans useFrame
            transparent
            opacity={0.8}
            roughness={0.1}
            metalness={0.9}
            clearcoat={1}
            envMapIntensity={2}
            depthWrite={false}
          />
        </mesh>
      </group>
    </group>
  );
}
