// lint-visual-disable-file
"use client";

import { MeshTransmissionMaterial } from "@react-three/drei";

interface GlassMaterialProps {
  distortion?: number;
  chromaticAberration?: number;
  ior?: number;
  color?: string;
  attenuationColor?: string;
  roughness?: number;
  thickness?: number;
}

/**
 * Matériau glass réutilisable pour les objets spatiaux.
 * Paramètres sensibles centralisés ici.
 */
export function GlassMaterial({
  distortion = 0.04,
  chromaticAberration = 0.02,
  ior = 1.25,
  color = "#ffffff",
  attenuationColor = "#ffffff",
  roughness = 0,
  thickness = 0.25,
}: GlassMaterialProps) {
  return (
    <MeshTransmissionMaterial
      samples={16}
      thickness={thickness}
      chromaticAberration={chromaticAberration}
      anisotropy={0.05}
      distortion={distortion}
      distortionScale={0.15}
      temporalDistortion={0}
      ior={ior}
      clearcoat={1}
      clearcoatRoughness={0}
      attenuationDistance={2}
      attenuationColor={attenuationColor}
      color={color}
      roughness={roughness}
    />
  );
}
