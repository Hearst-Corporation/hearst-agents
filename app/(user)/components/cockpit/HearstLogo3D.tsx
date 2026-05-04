"use client";
// lint-visual-disable-file
// Fallback hex pour SSR safety (Three.js Color attend une string parsable).
// La couleur réelle est lue via getComputedStyle(--cykan) côté client.

/**
 * HearstLogo3D — H Hearst en 3D animé (R3F + GLB).
 *
 * Asset : `public/hearst-3d-emerald.glb`. Adapté du `cinema-glb-viewer` de
 * Hearst-app (landing). Différences cockpit :
 * - Pas d'Environment HDRI (trop lourd pour un panneau central toujours visible)
 * - Couleur émissive lue depuis `--cykan` au runtime (single source of truth)
 * - Background transparent (laisse passer le `--bg` du shell)
 * - Idle float + rotation Y douces
 */

import { Component, Suspense, useMemo, useRef } from "react";
import type { ErrorInfo, ReactNode } from "react";
import dynamic from "next/dynamic";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, ContactShadows, Float } from "@react-three/drei";
import * as THREE from "three";

const GLB_PATH = "/hearst-3d-emerald.glb";

function readCykan(): string {
  if (typeof window === "undefined") return "#2DD4BF";
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue("--cykan")
    .trim();
  return v || "#2DD4BF";
}

function Model() {
  const { scene } = useGLTF(GLB_PATH);
  const groupRef = useRef<THREE.Group>(null);

  // Clone : on évite de muter le scene partagé par useGLTF (cache),
  // on centre / scale / colore notre instance sans impacter d'autres consommateurs.
  const prepared = useMemo(() => {
    const cloned = scene.clone(true) as THREE.Group;

    const box = new THREE.Box3().setFromObject(cloned as unknown as THREE.Object3D);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    cloned.position.set(-center.x, -center.y, -center.z);

    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = maxDim > 0 ? 2 / maxDim : 1;
    cloned.scale.setScalar(scale * 0.85);

    const cykan = new THREE.Color(readCykan());
    cloned.traverse((child: unknown) => {
      const obj = child as { type?: string; material?: unknown };
      if (obj.type !== "Mesh") return;
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      materials.forEach((mat: unknown) => {
        const m = mat as { emissive?: THREE.Color; emissiveIntensity?: number };
        if (m && m.emissive) {
          m.emissive = cykan;
          m.emissiveIntensity = 0.25;
        }
      });
    });

    return cloned;
  }, [scene]);

  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y = state.clock.elapsedTime * 0.18;
    groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.04;
  });

  return (
    <Float speed={1.4} rotationIntensity={0.15} floatIntensity={0.35}>
      <group ref={groupRef}>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <primitive object={prepared as any} />
      </group>
    </Float>
  );
}

function Scene() {
  const cykan = useMemo(() => readCykan(), []);

  return (
    <>
      <ambientLight intensity={0.35} />
      <spotLight
        position={[8, 10, 8]}
        angle={0.35}
        penumbra={1}
        intensity={1.2}
      />
      <pointLight position={[-8, -6, -8]} intensity={0.6} color={cykan} />
      <Suspense fallback={null}>
        <Model />
      </Suspense>
      <ContactShadows position={[0, -1.2, 0]} opacity={0.25} scale={8} blur={2.5} far={3.5} />
    </>
  );
}

function HearstLogo3DInner() {
  return (
    <Canvas
      camera={{ position: [0, 0, 4], fov: 45 }}
      dpr={[1, 1.5]}
      gl={{ antialias: false, alpha: true }}
      style={{ background: "transparent" }}
    >
      <Scene />
    </Canvas>
  );
}

const HearstLogo3DCanvas = dynamic(() => Promise.resolve(HearstLogo3DInner), {
  ssr: false,
  loading: () => <Logo3DPlaceholder kind="loading" />,
});

export function HearstLogo3D() {
  return (
    <section
      className="relative h-full w-full select-none"
      aria-label="Logo Hearst 3D"
    >
      <Logo3DErrorBoundary fallback={<Logo3DPlaceholder kind="error" />}>
        <HearstLogo3DCanvas />
      </Logo3DErrorBoundary>
    </section>
  );
}

function Logo3DPlaceholder({ kind }: { kind: "loading" | "error" }) {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{ color: "var(--text-faint)", padding: "var(--space-6)", textAlign: "center" }}
      aria-hidden="true"
    >
      <span className="t-11 font-light">
        {kind === "loading" ? "Chargement…" : "Logo 3D indisponible."}
      </span>
    </div>
  );
}

class Logo3DErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { hasError: boolean }> {
  constructor(props: { fallback: ReactNode; children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[HearstLogo3D] R3F runtime error:", error, info.componentStack);
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

useGLTF.preload(GLB_PATH);
