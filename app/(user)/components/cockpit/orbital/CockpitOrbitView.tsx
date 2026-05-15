"use client";

import type { CockpitTodayPayload } from "@/lib/cockpit/today";
import { OrbeCentral } from "./OrbeCentral";
import { OrbitalGreeting } from "./OrbitalGreeting";
import { OrbitalNodes } from "./OrbitalNodes";
import { OrbitalQuickActions } from "./OrbitalQuickActions";

interface CockpitOrbitViewProps {
  data: CockpitTodayPayload;
  onRefresh?: () => Promise<void>;
}

export function CockpitOrbitView({ data }: CockpitOrbitViewProps) {
  return (
    <div
      className="flex-1 flex flex-col min-h-0 overflow-hidden"
      style={{ background: "var(--bg)" }}
    >
      {/* Greeting */}
      <OrbitalGreeting />

      {/* Centre : layout flexbox pur avec lignes de connexion */}
      <div
        className="flex-1 flex flex-col items-center justify-center"
        style={{ padding: "var(--space-6) var(--space-8)", gap: "var(--space-10)" }}
      >
        {/* Haut : Gmail + ligne vers cœur */}
        <div style={{ position: "relative" }}>
          <OrbitalNodes data={data} row="top" />
          {/* Ligne verticale vers le bas */}
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: "50%",
              width: "1px",
              height: "var(--space-20)",
              background: "linear-gradient(to bottom, var(--mono-line) 0%, transparent 100%)",
              transform: "translateX(-50%)",
              pointerEvents: "none",
            }}
          />
        </div>

        {/* Milieu : Notion + cœur + Agent Research */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 60,
            position: "relative",
          }}
        >
          {/* Notion + ligne horizontale */}
          <div style={{ position: "relative" }}>
            <OrbitalNodes data={data} row="mid-left" />
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "100%",
                width: 60,
                height: "1px",
                background: "linear-gradient(to right, var(--mono-line) 0%, transparent 100%)",
                transform: "translateY(-50%)",
                pointerEvents: "none",
              }}
            />
          </div>

          {/* Cœur */}
          <div style={{ position: "relative", width: 180, height: 180 }}>
            {/* Halo de fond */}
            <div
              style={{
                position: "absolute",
                inset: -50,
                background:
                  "radial-gradient(circle at center, var(--mono-surface) 0%, transparent 55%)",
                pointerEvents: "none",
              }}
            />
            <OrbeCentral />
          </div>

          {/* Agent Research + ligne horizontale */}
          <div style={{ position: "relative" }}>
            <OrbitalNodes data={data} row="mid-right" />
            <div
              style={{
                position: "absolute",
                top: "50%",
                right: "100%",
                width: 60,
                height: "1px",
                background: "linear-gradient(to left, var(--mono-line) 0%, transparent 100%)",
                transform: "translateY(-50%)",
                pointerEvents: "none",
              }}
            />
          </div>
        </div>

        {/* Bas : cœur + nodes + lignes diagonales dans un conteneur commun */}
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 0,
          }}
        >
          {/* Lignes diagonales depuis le cœur vers les nodes du bas */}
          {/* La ligne part du haut de cette zone (bas du cœur) et va vers les nodes */}
          <div
            style={{
              position: "absolute",
              top: -40,
              left: "50%",
              width: 1,
              height: "var(--space-10)",
              background: "linear-gradient(to bottom, var(--mono-line) 0%, transparent 100%)",
              transform: "translateX(-50%)",
              pointerEvents: "none",
            }}
          />
          {/* Ligne diagonale vers Drive (gauche) */}
          <div
            style={{
              position: "absolute",
              top: -30,
              left: "30%",
              width: "var(--space-20)",
              height: 1,
              background:
                "linear-gradient(to bottom left, var(--mono-line-dim) 0%, transparent 100%)",
              transform: "rotate(50deg)",
              transformOrigin: "top left",
              pointerEvents: "none",
            }}
          />
          {/* Ligne diagonale vers Calendar (droite) */}
          <div
            style={{
              position: "absolute",
              top: -30,
              right: "30%",
              width: "var(--space-20)",
              height: 1,
              background:
                "linear-gradient(to bottom right, var(--mono-line-dim) 0%, transparent 100%)",
              transform: "rotate(-50deg)",
              transformOrigin: "top right",
              pointerEvents: "none",
            }}
          />

          <div style={{ display: "flex", gap: "var(--space-10)" }}>
            <OrbitalNodes data={data} row="bottom" />
          </div>
        </div>
      </div>

      <OrbitalQuickActions />
    </div>
  );
}
