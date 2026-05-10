"use client";

import { FloatingPanel } from "./FloatingPanel";

type MissionState = "idle" | "running";

interface MissionPanelProps {
  show: boolean;
  state?: MissionState;
}

/**
 * Mission — panel droit.
 * Reflète l'état réel : aucune mission, ou analyse en cours.
 */
export function MissionPanel({ show, state = "idle" }: MissionPanelProps) {
  const running = state === "running";
  return (
    <FloatingPanel show={show} anchor="right" delay={0.18} width={240}>
      <div className="px-6 py-6">
        <div className="text-white/30 text-[9px] tracking-[0.3em] uppercase font-light mb-4">
          Mission
        </div>
        <p className="text-white/70 text-[12px] font-light leading-[1.6]">
          {running ? "Analyse en cours" : "Aucune mission active"}
        </p>
        <div className="mt-5 flex items-center gap-3">
          <div
            className="w-1 h-1 rounded-full bg-white/40"
            style={{
              boxShadow: running
                ? "0 0 6px rgba(255,255,255,0.4)"
                : "0 0 4px rgba(255,255,255,0.2)",
              animation: running ? "spatial-mission-pulse 2.4s ease-in-out infinite" : undefined,
            }}
          />
          <div className="text-white/40 text-[10px] tracking-wide font-light">
            {running ? "Agents mobilisés" : "En attente"}
          </div>
        </div>
      </div>
    </FloatingPanel>
  );
}
