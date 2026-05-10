// lint-visual-disable-file
"use client";

import { Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import { ArtifactKernel } from "./ArtifactKernel";
import { useSpatialStore } from "./store";

function CameraRig() {
  const isExpanded = useSpatialStore((state) => state.isExpanded);

  useFrame((state) => {
    // Si étendu, on recule la caméra pour faire de la place à la constellation
    const targetZ = isExpanded ? 8.5 : 4.95;
    state.camera.position.z = THREE.MathUtils.lerp(state.camera.position.z, targetZ, 0.04);
  });

  return null;
}

function StudioLights() {
  return (
    <>
      <Environment resolution={1024}>
        <Lightformer form="rect" intensity={3.5} color="#ffffff" position={[0, 3.85, 3.7]} scale={[4.2, 0.56, 1]} />
        <Lightformer form="rect" intensity={4.5} color="#e2e8f0" position={[-2.65, 0.08, 2.9]} scale={[0.08, 3.25, 1]} />
        <Lightformer form="rect" intensity={3.0} color="#f8fafc" position={[2.74, -0.12, 2.56]} scale={[0.065, 2.8, 1]} />
        <Lightformer form="rect" intensity={3.0} color="#ffffff" position={[0.16, -1.66, 2.84]} scale={[2.25, 0.08, 1]} />
        <Lightformer form="rect" intensity={1.5} color="#d1d5db" position={[-1.08, 1.42, 3.36]} scale={[1.28, 0.06, 1]} />
        <Lightformer form="rect" intensity={1.2} color="#f1f5f9" position={[1.22, -1.08, 3.18]} scale={[1.0, 0.05, 1]} />
      </Environment>
    </>
  );
}

function SpatialCanvas() {
  return (
    <Canvas dpr={[1, 1.8]} gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}>
      <PerspectiveCamera makeDefault position={[0, 0, 4.95]} fov={33} />
      <color attach="background" args={["#000000"]} />
      {/* On repousse le brouillard pour que la caméra (Z=8.5) ne plonge pas la scène dans le noir */}
      <fog attach="fog" args={["#000000", 9.5, 18]} />

      <Suspense fallback={null}>
        <CameraRig />
        <StudioLights />
        <ArtifactKernel />
      </Suspense>
    </Canvas>
  );
}

function SideRail({ side, title, items }: { side: "left" | "right"; title: string; items: string[] }) {
  const isExpanded = useSpatialStore((state) => state.isExpanded);

  return (
    <aside
      className={[
        "pointer-events-auto hidden md:block absolute top-1/2 w-[220px] -translate-y-1/2",
        side === "left" ? "left-[clamp(44px,8vw,132px)]" : "right-[clamp(44px,8vw,132px)]",
        "transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-105",
        isExpanded ? "opacity-0 translate-x-[calc(var(--tw-translate-x)*2)] pointer-events-none" : "opacity-100 translate-x-0"
      ].join(" ")}
      style={{
        transitionDelay: isExpanded ? "0ms" : side === "left" ? "100ms" : "200ms",
      }}
      aria-label={title}
    >
      <div 
        className="bg-white/[0.02] px-6 py-6 backdrop-blur-[32px] rounded-[24px] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_0_20px_rgba(255,255,255,0.02),0_24px_48px_rgba(0,0,0,0.6)]" 
      >
        <div 
          className={[
            "mb-5 text-[10px] uppercase tracking-[0.2em] text-white/50 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]",
            isExpanded ? "opacity-0 translate-x-4" : "opacity-100 translate-x-0"
          ].join(" ")}
          style={{ transitionDelay: `${isExpanded ? 0 : (items.length + 1) * 75 + (side === "left" ? 100 : 200)}ms` }}
        >
          {title}
        </div>
        <div className="space-y-3">
          {items.map((item, index) => (
            <div
              key={item}
              className={[
                "text-[13px] font-light tracking-wide text-white/70 drop-shadow-sm cursor-default hover:text-white transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]",
                isExpanded ? "opacity-0 translate-x-4" : "opacity-100 translate-x-0"
              ].join(" ")}
              style={{
                transitionDelay: `${isExpanded ? index * 75 : (items.length - index) * 75 + (side === "left" ? 100 : 200)}ms`
              }}
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

function CommandDock() {
  const isExpanded = useSpatialStore((state) => state.isExpanded);

  return (
    <form 
      className={[
        "pointer-events-auto absolute inset-x-0 bottom-[88px] flex justify-center px-5 md:bottom-[clamp(32px,6vh,64px)]",
        "transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)]",
        isExpanded ? "opacity-0 translate-y-8 pointer-events-none" : "opacity-100 translate-y-0"
      ].join(" ")}
      style={{
        transitionDelay: isExpanded ? "100ms" : "300ms",
      }}
      onSubmit={(e) => {
        e.preventDefault();
        // TODO: Orchestration de la commande
      }}
    >
      <div
        className="flex h-[44px] w-[min(320px,calc(100vw-40px))] items-center bg-white/[0.02] px-6 backdrop-blur-[32px] rounded-[24px] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_0_20px_rgba(255,255,255,0.02),0_24px_48px_rgba(0,0,0,0.6)] transition-all duration-500 ease-out hover:bg-white/[0.04] hover:scale-[1.02]"
      >
        <input
          className="w-full bg-transparent text-[14px] font-light text-white/70 outline-none placeholder:text-white/40 text-center drop-shadow-sm transition-colors focus:text-white"
          placeholder="Demander une orchestration"
          aria-label="Demander une orchestration"
        />
      </div>
    </form>
  );
}

export function SpatialV2Root() {
  return (
    <main className="fixed inset-0 isolate overflow-hidden bg-black text-white">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(1200px 700px at 50% 48%, rgba(255,255,255,0.06), rgba(0,0,0,0) 62%)",
        }}
      />

      <div className="absolute inset-0">
        <SpatialCanvas />
      </div>

      <div className="pointer-events-none absolute inset-0">
        <header className="absolute left-[clamp(22px,4vw,58px)] top-[clamp(20px,4vh,44px)] text-[11px] font-light tracking-widest text-white/30 drop-shadow-sm">
          HEARST OS
        </header>

        <SideRail side="left" title="Signal" items={["Contexte prêt", "Sources calmes", "Décision nette"]} />
        <SideRail side="right" title="Orchestration" items={["Mémoire active", "Agents distants", "Sortie contrôlée"]} />

        <CommandDock />
      </div>
    </main>
  );
}
