// lint-visual-disable-file — prototype luxe orbital, palette ad-hoc hors DS
"use client";

import { useRef, useState, useEffect } from "react";
import type { CockpitTodayPayload } from "@/lib/cockpit/today";
import { OrbeCentral } from "./OrbeCentral";
import { OrbitalGreeting } from "./OrbitalGreeting";
import { OrbitalNodes, NODE_OFFSETS } from "./OrbitalNodes";
import { OrbitalConnections } from "./OrbitalConnections";
import { OrbitalQuickActions } from "./OrbitalQuickActions";

interface CockpitOrbitViewProps {
  data: CockpitTodayPayload;
  onRefresh?: () => Promise<void>;
}

export function CockpitOrbitView({ data }: CockpitOrbitViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setDims({
        w: entry.contentRect.width,
        h: entry.contentRect.height,
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const centerX = dims.w / 2;
  const centerY = dims.h / 2;

  const nodeAbsolutePositions = NODE_OFFSETS.map((o) => ({
    x: centerX + o.x,
    y: centerY + o.y,
  }));

  return (
    <div
      className="flex-1 flex flex-col min-h-0 overflow-hidden"
      style={{ background: "#000", position: "relative" }}
    >
      {/* Halo radial de fond — centré sur l'écran */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: "30%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 600,
          height: 400,
          background: "radial-gradient(ellipse at center, rgba(74,139,134,0.06) 0%, rgba(30,50,80,0.04) 40%, transparent 70%)",
          filter: "blur(40px)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* Greeting */}
      <OrbitalGreeting />

      {/* Zone orbital */}
      <div
        ref={containerRef}
        className="flex-1 relative"
        style={{ minHeight: 0, zIndex: 1 }}
      >
        {dims.w > 0 && (
          <>
            {/* Connexions SVG */}
            <OrbitalConnections
              center={{ x: centerX, y: centerY }}
              nodePositions={nodeAbsolutePositions}
              width={dims.w}
              height={dims.h}
              orbeRadius={104}
            />

            {/* Orbe — centré absolument */}
            <div style={{
              position: "absolute",
              left: centerX,
              top: centerY,
              transform: "translate(-50%, -50%)",
              zIndex: 2,
            }}>
              <OrbeCentral />
            </div>

            {/* Nodes services */}
            <div style={{ position: "absolute", inset: 0, zIndex: 3 }}>
              <OrbitalNodes data={data} centerX={centerX} centerY={centerY} />
            </div>
          </>
        )}
      </div>

      {/* Quick actions */}
      <OrbitalQuickActions />
    </div>
  );
}
