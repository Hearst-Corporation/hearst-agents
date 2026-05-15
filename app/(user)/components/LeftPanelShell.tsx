"use client";

/**
 * LeftPanelShell — Container responsive autour de LeftPanel.
 *
 * Desktop (>= md): rendu inline classique, sidebar fixe.
 * Mobile (< md): drawer caché par défaut, ouvert via hamburger PulseBar
 * (`useNavigationStore.toggleLeftDrawer`). Backdrop cliquable pour fermer.
 *
 * Mirroir du pattern utilisé par [RightPanel.tsx](./RightPanel.tsx). Z-index
 * cohérent : drawer = --z-modal (50), backdrop = --z-backdrop (45),
 * sous le ToastContainer (--z-toast = 70).
 */

import { useEffect, useState } from "react";
import { useModalA11y } from "@/app/(user)/hooks/useModalA11y";
import { useNavigationStore } from "@/stores/navigation";
import { TimelineRail } from "./TimelineRail";

export function LeftPanelShell() {
  const [isMobile, setIsMobile] = useState(false);
  const leftDrawerOpen = useNavigationStore((s) => s.leftDrawerOpen);
  const closeLeftDrawer = useNavigationStore((s) => s.closeLeftDrawer);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Si on revient en desktop alors que le drawer était ouvert, on le ferme
  // pour éviter un état orphelin (drawer "ouvert" derrière la sidebar inline).
  useEffect(() => {
    if (!isMobile && leftDrawerOpen) {
      closeLeftDrawer();
    }
  }, [isMobile, leftDrawerOpen, closeLeftDrawer]);

  return (
    <MobileAwareTimeline
      isMobile={isMobile}
      leftDrawerOpen={leftDrawerOpen}
      closeLeftDrawer={closeLeftDrawer}
    />
  );
}

function MobileAwareTimeline({
  isMobile,
  leftDrawerOpen,
  closeLeftDrawer,
}: {
  isMobile: boolean;
  leftDrawerOpen: boolean;
  closeLeftDrawer: () => void;
}) {
  // Focus trap + scroll lock + Escape (mobile drawer only).
  // Sur desktop, le hook reçoit `open=false` et n'a aucun effet.
  const drawerRef = useModalA11y<HTMLDivElement>(isMobile && leftDrawerOpen, {
    onClose: closeLeftDrawer,
  });

  if (!isMobile) {
    return <TimelineRail />;
  }

  return (
    <>
      {leftDrawerOpen && (
        <div
          className="fixed inset-0"
          style={{
            zIndex: "var(--z-backdrop)" as unknown as number,
            background: "var(--overlay-scrim)",
          }}
          onClick={closeLeftDrawer}
          aria-hidden
        />
      )}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Conversations"
        aria-hidden={!leftDrawerOpen}
        className={`fixed top-0 left-0 h-full transform transition-transform duration-slow ease-out-soft ${
          leftDrawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ zIndex: "var(--z-modal)" as unknown as number }}
      >
        <TimelineRail />
      </div>
    </>
  );
}
