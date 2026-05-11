"use client";

import { useRef, useEffect } from "react";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { useSpatialEntityState, useSpatialSelection } from "@/stores/spatial-selection";
import { panelRegistry } from "@/lib/spatial/panel-registry";
import { motion } from "framer-motion";

interface Panel3DProps {
  position: [number, number, number];
  entityId: string;
  children: React.ReactNode;
  name: string;
}

export function PanelKPI3D({ position, entityId }: { position: [number, number, number], entityId: string }) {
  const kpis = [
    { label: 'Agenda', value: '04' },
    { label: 'Missions', value: '02' },
    { label: 'Suggestions', value: '06' },
  ];

  return (
    <PanelBase3D position={position} entityId={entityId} name="panel-kpi-3d">
      <div className="flex h-full items-center justify-between gap-8 px-2">
        {kpis.map((k) => (
          <div key={k.label} className="flex flex-1 flex-col items-start">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">
              {k.label}
            </div>
            <div className="text-3xl font-extralight tracking-tight text-white/95">
              {k.value}
            </div>
          </div>
        ))}
      </div>
    </PanelBase3D>
  );
}

export function PanelMission3D({ position, entityId }: { position: [number, number, number], entityId: string }) {
  return (
    <PanelBase3D position={position} entityId={entityId} name="panel-mission-3d">
      <div className="flex h-full flex-col justify-between">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">
              Mission
            </span>
          </div>
          <div className="text-2xl font-extralight tracking-tight text-white/95 line-clamp-2">
            Daily brief en cours
          </div>
          <div className="mt-1 text-sm font-light text-white/45">
            3/7 étapes
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-1.5 w-1.5 rounded-full bg-white/90 shadow-[0_0_10px_rgba(255,255,255,0.6)] animate-pulse" />
          <div className="text-sm font-light tracking-wide text-white/55">
            Agents mobilisés
          </div>
        </div>
      </div>
    </PanelBase3D>
  );
}

export function PanelBrief3D({ position, entityId }: { position: [number, number, number], entityId: string }) {
  const bullets = [
    "Meeting stratégique à 10:00",
    "3 rapports à valider",
    "Analyse de marché terminée"
  ];

  return (
    <PanelBase3D position={position} entityId={entityId} name="panel-brief-3d">
      <div className="flex h-full flex-col justify-between">
        <div>
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">
            Brief
          </div>
          <div className="mb-3 text-3xl font-extralight tracking-tight text-white/95">
            Bonjour
          </div>
          <ul className="space-y-1">
            {bullets.map((b, i) => (
              <li key={i} className="text-sm font-light text-white/70 flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-white/30" />
                {b}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </PanelBase3D>
  );
}

function PanelBase3D({ position, entityId, children, name }: Panel3DProps) {
  const groupRef = useRef<THREE.Group>(null);
  const { isHovered, isSelected, isPinned, isDefocused } = useSpatialEntityState(entityId);
  const { hover, select, togglePin } = useSpatialSelection();

  useEffect(() => {
    if (groupRef.current) {
      panelRegistry.set(entityId, new THREE.Vector3(...position));
    }
    return () => {
      panelRegistry.delete(entityId);
    };
  }, [entityId, position]);

  const handleClick = (e: any) => {
    e.stopPropagation();
    select(entityId, { multi: e.shiftKey });
  };

  return (
    <group 
      ref={groupRef} 
      position={position} 
      name={name}
      onPointerOver={(e) => { e.stopPropagation(); hover(entityId); }}
      onPointerOut={() => hover(null)}
      onClick={handleClick}
    >
      <Html 
        transform 
        occlude="blending"
        distanceFactor={10}
      >
        <motion.div
          animate={{
            scale: isSelected ? 1.06 : isHovered ? 1.04 : 1,
            opacity: isDefocused ? 0.4 : 1,
            filter: isDefocused ? 'saturate(0.6)' : 'saturate(1)',
          }}
          transition={{
            duration: isSelected ? 1.8 : 0.28,
            ease: [0.65, 0, 0.35, 1]
          }}
          className={`
            relative w-[400px] h-[240px] rounded-[32px] p-8
            bg-white/[0.05] backdrop-blur-[22px] saturate-[130%]
            border border-white/10 select-none cursor-pointer
            ${isHovered ? 'shadow-[0_0_30px_rgba(255,250,240,0.3)] border-white/25' : ''}
            ${isSelected ? 'shadow-[0_0_40px_rgba(255,255,255,0.6)] border-white/40' : ''}
            ${isPinned ? 'shadow-[0_0_40px_rgba(0,229,204,0.5)] border-[#00e5cc]/40' : ''}
          `}
          style={{
            transformStyle: 'preserve-3d',
          }}
        >
          {children}
        </motion.div>
      </Html>
    </group>
  );
}
