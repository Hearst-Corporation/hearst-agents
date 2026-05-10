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
    <FloatingPanel show={show} anchor="right" delay={0.18} width={272}>
      <div className="px-7 py-7">
        <div className="text-white/45 text-[10px] tracking-[0.34em] uppercase font-light mb-5">
          Mission
        </div>
        <p className="text-white/90 text-[13px] font-light leading-[1.65]">
          {running ? "Analyse en cours" : "Aucune mission active"}
        </p>
        <div className="mt-6 flex items-center gap-3">
          <div
            className="w-1 h-1 rounded-full bg-white/65"
            style={{
              boxShadow: running
                ? "0 0 8px rgba(255,255,255,0.6)"
                : "0 0 5px rgba(255,255,255,0.45)",
              animation: running ? "spatial-mission-pulse 2.4s ease-in-out infinite" : undefined,
            }}
          />
          <div className="text-white/55 text-[11px] tracking-wide font-light">
            {running ? "Agents mobilisés" : "En attente d'intention"}
          </div>
        </div>
      </div>
    </FloatingPanel>
  );
}
