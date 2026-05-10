/**
 * RailHeader — bloc logo en tête du rail.
 *
 * Invariant I-10 : logo Hearst intouchable. Expanded → <HearstLogo />,
 * collapsed → caractère "H" en teal sourd avec halo-cyan-sm. Click →
 * handleHome (= setActiveThread(null) + setStageMode cockpit).
 */

// lint-visual-disable-file
import { HearstLogo } from "../HearstLogo";

export interface RailHeaderProps {
  collapsed: boolean;
  onHome: () => void;
}

export function RailHeader({ collapsed, onHome }: RailHeaderProps) {
  return (
    <div
      className="shrink-0 flex items-center justify-center pt-8 pb-8 px-8"
      style={{
        boxShadow: "none",
        borderBottom: "1px solid rgba(255, 255, 255, 0.05)"
      }}
    >
      <button
        onClick={onHome}
        className="flex items-center justify-center hover:opacity-80 transition-all duration-300"
        title="Hearst"
      >
        {collapsed ? (
          <span className="font-medium tracking-tight leading-none" style={{ fontSize: "15px", color: "rgba(255,255,255,0.8)" }}>
            H
          </span>
        ) : (
          <div className="flex items-center gap-3">
            <div style={{ 
              width: "24px", 
              height: "24px", 
              borderRadius: "50%", 
              border: "3px solid rgba(167, 139, 250, 0.3)", 
              borderTopColor: "rgba(167, 139, 250, 1)", 
              boxShadow: "0 0 16px rgba(167, 139, 250, 0.6), inset 0 0 8px rgba(167, 139, 250, 0.4)", 
              transform: "rotate(-45deg)" 
            }} />
            <span className="font-light" style={{ fontSize: "20px", color: "rgba(255, 255, 255, 0.9)", letterSpacing: "0.02em" }}>
              halo
            </span>
          </div>
        )}
      </button>
    </div>
  );
}
