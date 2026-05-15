import { type ReactNode } from "react";
import { AmbientLayers } from "./AmbientLayers";
import { Footer } from "./Footer";
import { LeftRail } from "./LeftRail";
import { RightRail } from "./RightRail";

interface ShellProps {
  children: ReactNode;
}

export function Shell({ children }: ShellProps) {
  return (
    <div
      className="perspective-scene"
      style={{
        display: "flex",
        height: "100vh",
        width: "100vw",
        overflow: "hidden",
        background: "#000",
        color: "rgba(255,255,255,0.88)",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter var", system-ui, sans-serif',
      }}
    >
      <LeftRail />

      {/* Center + RightRail */}
      <div style={{ flex: 1, display: "flex", minWidth: 0 }}>
        {/* Center */}
        <main
          style={{
            flex: 1,
            position: "relative",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <AmbientLayers />

          {/* Scrollable content */}
          <div
            className="vision-content-depth"
            style={{
              flex: 1,
              overflowY: "auto",
              overflowX: "hidden",
              position: "relative",
              zIndex: 1,
              paddingBottom: 120,
            }}
          >
            {children}
          </div>

          {/* Bottom fade-out */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 140,
              background:
                "linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.6) 50%, transparent 100%)",
              pointerEvents: "none",
              zIndex: 2,
            }}
          />

          <Footer />
        </main>

        <RightRail />
      </div>
    </div>
  );
}
