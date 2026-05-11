"use client";

import { Environment, MeshTransmissionMaterial, Edges } from "@react-three/drei";
import { useSpatialSceneStore } from "@/stores/spatial-scene";

/**
 * SpatialEnvironment - Gère l'environnement 3D, les lumières et les structures monolithiques.
 * Fallback procédural : Piliers cylindriques avec MeshTransmissionMaterial et Edges.
 */
export function SpatialEnvironment() {
  const lights = useSpatialSceneStore((state) => state.lights);
  const envModel = useSpatialSceneStore((state) => state.environmentModel);
  const envConfig = useSpatialSceneStore((state) => state.environment);

  return (
    <group name="scene-root">
      {/* ... (HDRI and Lights remain same) ... */}
      <Environment 
        files={envConfig.path} 
        environmentIntensity={envConfig.intensity} 
        background={false} 
      />

      {/* Lumières */}
      <ambientLight 
        name="ambient-light" 
        intensity={lights.ambient.intensity} 
        color={lights.ambient.color} 
      />
      
      <directionalLight
        name="directional-key"
        intensity={lights.directional.intensity}
        color={lights.directional.color}
        position={lights.directional.position}
      />

      <pointLight
        name="rim-light"
        intensity={lights.rim.intensity}
        color={lights.rim.color}
        position={lights.rim.position}
        distance={lights.rim.distance}
        decay={lights.rim.decay}
      />

      <pointLight
        name="accent-warm"
        intensity={lights.accentWarm.intensity}
        color={lights.accentWarm.color}
        position={lights.accentWarm.position}
        distance={lights.accentWarm.distance}
        decay={lights.accentWarm.decay}
      />

      <pointLight
        name="accent-cool"
        intensity={lights.accentCool.intensity}
        color={lights.accentCool.color}
        position={lights.accentCool.position}
        distance={lights.accentCool.distance}
        decay={lights.accentCool.decay}
      />

      {/* Sol Minéral PBR */}
      <mesh
        name="ground-plane"
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -4, 0]}
        receiveShadow
      >
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial 
          color="#1a2030" 
          roughness={0.85} 
          metalness={0.15} 
        />
      </mesh>

      {/* Rayons de lumière (Godrays simulés) */}
      <group name="volumetric-light">
        <mesh name="godray-primary" position={[6, 0, 0]} rotation={[0.2, 0, 0.1]}>
          <cylinderGeometry args={[0.1, 2, 20, 32]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.05} />
        </mesh>
        <mesh name="godray-secondary" position={[-4, 0, -5]} rotation={[-0.1, 0, -0.2]}>
          <cylinderGeometry args={[0.05, 1.5, 15, 32]} />
          <meshBasicMaterial color="#5a7aa8" transparent opacity={0.03} />
        </mesh>
      </group>

      {/* Structures Monolithiques Procédurales */}
      <group 
        name={envModel.name}
        position={envModel.position}
        rotation={envModel.rotation}
        scale={envModel.scale}
      >
        {/* Pilier Gauche - Brutaliste */}
        <mesh name="pillar-left" position={[-7, 4, 2]} rotation={[0, 0.4, 0]}>
          <cylinderGeometry args={[1.5, 1.5, 10, 32]} />
          <meshStandardMaterial color="#4a5668" roughness={0.45} metalness={0.55} />
          <Edges color="#7aa8e0" threshold={20} />
        </mesh>

        {/* Pilier Central - Cristal / Verre (Transmission) */}
        <mesh name="pillar-center" position={[0, 5, -8]}>
          <cylinderGeometry args={[1.2, 1.2, 12, 32]} />
          <MeshTransmissionMaterial 
            backside 
            samples={4} 
            thickness={3} 
            chromaticAberration={0.025} 
            anisotropy={0.1} 
            distortion={0.1} 
            distortionScale={0.1} 
            temporalDistortion={0.1} 
            color="#5a7aa8"
          />
          <Edges color="#ffffff" threshold={20} />
        </mesh>

        {/* Pilier Droit - Brutaliste Sombre */}
        <mesh name="pillar-right" position={[6, 3, -2]} rotation={[0, -Math.PI / 8, 0]}>
          <cylinderGeometry args={[2, 2, 12, 32]} />
          <meshStandardMaterial color="#323c4d" roughness={0.4} metalness={0.6} />
          <Edges color="#e8b078" threshold={20} />
        </mesh>
      </group>
    </group>
  );
}
