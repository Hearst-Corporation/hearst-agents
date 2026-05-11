"use client";

import { Html } from "@react-three/drei";
import { Object3D, Group } from "three";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";

export function SpatialObjectLabel({ target, name }: { target: Object3D; name: string }) {
  const groupRef = useRef<Group>(null);
  const coordsRef = useRef<HTMLDivElement>(null);

  useFrame(() => {
    if (target && groupRef.current) {
      groupRef.current.position.set(
        target.position.x,
        target.position.y + 1,
        target.position.z
      );
      
      if (coordsRef.current) {
        coordsRef.current.innerText = `[${Number(target.position.x.toFixed(1))}, ${Number(target.position.y.toFixed(1))}, ${Number(target.position.z.toFixed(1))}]`;
      }
    }
  });

  return (
    <group name={`label-${name}`} ref={groupRef}>
      <Html center>
        <div className="bg-black/50 border border-white/10 px-2 py-1 rounded backdrop-blur-md whitespace-nowrap pointer-events-none select-none text-center">
          <div className="font-bold text-white text-spatial-sm leading-tight">{name}</div>
          <div ref={coordsRef} className="font-mono text-white/60 text-spatial-xs leading-tight">
            [0, 0, 0]
          </div>
        </div>
      </Html>
    </group>
  );
}
