"use client";

/**
 * GlassKnotVortexCore — variante du noyau central basée sur un asset GLTF
 * statique livré dans /public/glass_knot_vortex.gltf.
 *
 * Le fichier source contient son propre éclairage (Point + 2 Directional)
 * mais on n'utilise QUE la géométrie : on extrait le mesh "Torus Knot",
 * on lui applique notre matériau, et on laisse l'éclairage de la scène
 * playground/spatiale faire le travail. Les lumières du GLTF sont donc
 * volontairement ignorées via primitive sur un sous-noeud précis.
 *
 * Le mesh d'origine est exporté avec une matrice qui le scale à 0.01 +
 * une rotation ; on le charge tel quel via <primitive object={scene}/>
 * mais on contre-scale le groupe pour qu'il occupe le même volume que
 * les autres variantes (radius effectif ~1.5).
 */

import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

interface CoreProps {
  stage: "idle" | "focus" | "mission" | "asset";
  hoveredNode: string | null;
  onClick: () => void;
}

const ASSET_URL = "/glass_knot_vortex.gltf";

export function GlassKnotVortexCore({ stage, hoveredNode, onClick }: CoreProps) {
  const groupRef = useRef<THREE.Group>(null);
  const meshGroupRef = useRef<THREE.Group>(null);
  const targetScale = useMemo(() => new THREE.Vector3(1, 1, 1), []);

  const { scene } = useGLTF(ASSET_URL);

  // Clone pour éviter les mutations partagées entre instances éventuelles,
  // et nettoyer en supprimant les lumières internes du GLTF (on garde
  // uniquement la géométrie ; l'éclairage vient de la scène hôte).
  const cleaned = useMemo(() => {
    const root = scene.clone(true);
    const toRemove: THREE.Object3D[] = [];
    root.traverse((obj) => {
      if ((obj as THREE.Light).isLight) {
        toRemove.push(obj);
      }
      // Applique un matériau cohérent avec notre DS sans détruire la
      // géométrie source. Pour un torus knot en "verre", on garde le
      // glass canon (Physical material avec transmission).
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        const physical = new THREE.MeshPhysicalMaterial({
          color: 0xffffff,
          roughness: 0.05,
          metalness: 0,
          transmission: 1,
          thickness: 0.4,
          ior: 1.45,
          clearcoat: 1,
          clearcoatRoughness: 0,
          attenuationDistance: 4,
          attenuationColor: new THREE.Color(0xffffff),
          envMapIntensity: 1.5,
        });
        mesh.material = physical;
      }
    });
    toRemove.forEach((l) => l.parent?.remove(l));
    return root;
  }, [scene]);

  useEffect(() => {
    return () => {
      cleaned.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh) {
          (mesh.material as THREE.Material | undefined)?.dispose?.();
        }
      });
    };
  }, [cleaned]);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();

    if (meshGroupRef.current) {
      meshGroupRef.current.rotation.y = time * 0.15;
      meshGroupRef.current.rotation.x = Math.sin(time * 0.3) * 0.1;
    }

    if (groupRef.current) {
      let scale = 1;
      if (stage === "focus") scale = 1.15;
      if (stage === "mission") scale = 0.85;
      if (stage === "asset") scale = 0.65;
      if (hoveredNode) scale += 0.05;

      const breath = Math.sin(time * 1.4) * 0.02;
      targetScale.set(scale + breath, scale + breath, scale + breath);
      groupRef.current.scale.lerp(targetScale, 0.08);
    }
  });

  return (
    <group
      ref={groupRef}
      onClick={onClick}
      onPointerOver={() => (document.body.style.cursor = "pointer")}
      onPointerOut={() => (document.body.style.cursor = "auto")}
    >
      <group ref={meshGroupRef} scale={[0.9, 0.9, 0.9]}>
        <primitive object={cleaned} />
      </group>
    </group>
  );
}

useGLTF.preload(ASSET_URL);
