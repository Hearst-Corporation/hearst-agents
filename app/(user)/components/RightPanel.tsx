"use client";

/**
 * RightPanel — Responsive container with drawer behavior on mobile
 *
 * Desktop (>= md): Fixed sidebar inline with layout
 * Mobile (< md): Full-height drawer with toggle button and overlay
 */

import { useEffect, useState } from "react";
import { ContextRail } from "./ContextRail";
import { GhostIconMenu, GhostIconX } from "./ghost-icons";

export function RightPanel() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile breakpoint (md = 768px)
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return (
    <>
      {/* Mobile: Drawer with toggle */}
      {isMobile && (
        <>
          {/* Floating toggle button */}
          <button
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            className={`fixed right-4 w-12 h-12 rounded-(--radius-md) flex items-center justify-center border transition-colors duration-(--duration-base) ${
              isMobileOpen
                ? "bg-bg-elev text-(--danger) border-(--danger)"
                : "bg-(--accent-teal) text-[var(--text-on-accent-teal)] border-(--line-strong)"
            }`}
            style={{
              zIndex: "var(--z-modal)" as unknown as number,
              // Au-dessus du MobileBottomNav (--height-mobile-nav + safe-area + space-4)
              bottom:
                "calc(var(--height-mobile-nav) + env(safe-area-inset-bottom, 0px) + var(--space-4))",
            }}
            aria-label={isMobileOpen ? "Fermer le panneau" : "Ouvrir le panneau runtime"}
          >
            {isMobileOpen ? (
              <GhostIconX className="w-5 h-5" />
            ) : (
              <GhostIconMenu className="w-5 h-5" />
            )}
          </button>

          {isMobileOpen && (
            <div
              className="ghost-overlay-backdrop"
              style={{ zIndex: "var(--z-backdrop)" as unknown as number }}
              onClick={() => setIsMobileOpen(false)}
              aria-hidden
            />
          )}

          {/* Drawer panel */}
          <div
            className={`fixed top-0 right-0 h-full transform transition-transform duration-slow ease-out-soft ${
              isMobileOpen ? "translate-x-0" : "translate-x-full"
            }`}
            style={{ zIndex: "var(--z-modal)" as unknown as number }}
          >
            <ContextRail onClose={() => setIsMobileOpen(false)} />
          </div>
        </>
      )}

      {/* Desktop: Inline panel (visibility controlled by layout.tsx) */}
      {!isMobile && <ContextRail />}
    </>
  );
}
