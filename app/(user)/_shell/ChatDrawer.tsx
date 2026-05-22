"use client";

import { AnimatePresence, motion } from "framer-motion";
import { type RefObject, useEffect, useRef, useState } from "react";

import { RightRailChat } from "./RightRailChat";

function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active || !ref.current) return;
    const el = ref.current;
    const focusable = el.querySelectorAll<HTMLElement>(
      'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    el.addEventListener("keydown", handleKey);
    first?.focus();
    return () => el.removeEventListener("keydown", handleKey);
  }, [active, ref]);
}

export function ChatDrawer() {
  const [open, setOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);

  const prefersReducedMotion =
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;

  useFocusTrap(drawerRef, open);

  // Fermer au clic en dehors
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Fermer avec Escape + retour focus FAB
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        fabRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  // Lock body scroll
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const motionTransition = prefersReducedMotion
    ? { duration: 0 }
    : { type: "spring" as const, damping: 25, stiffness: 200 };

  const backdropTransition = prefersReducedMotion ? { duration: 0 } : { duration: 0.2 };

  return (
    <>
      {/* FAB — visible uniquement sous xl */}
      <button
        ref={fabRef}
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full text-black transition-transform hover:scale-105 active:scale-95 xl:hidden"
        style={{
          background: "var(--accent-teal)",
          boxShadow: "var(--shadow-card)",
        }}
        aria-label="Ouvrir le chat avec Kimi"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={backdropTransition}
              className="fixed inset-0 z-40 bg-black/60 xl:hidden"
              aria-hidden="true"
            />

            {/* Drawer */}
            <motion.div
              ref={drawerRef}
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={motionTransition}
              className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-md xl:hidden"
              style={{ background: "var(--surface-1)" }}
              role="dialog"
              aria-label="Chat avec Kimi"
              aria-modal="true"
            >
              {/* Header drawer */}
              <div
                className="flex items-center justify-between border-b px-4 py-3"
                style={{ borderColor: "var(--border-shell)" }}
              >
                <span className="t-15 font-medium text-text">Chat</span>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    fabRef.current?.focus();
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-150"
                  style={{
                    color: "var(--text-ghost)",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.color = "var(--text)";
                    (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-2)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.color = "var(--text-ghost)";
                    (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                  }}
                  aria-label="Fermer le chat"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {/* Contenu chat */}
              <div className="h-[calc(100%-57px)]">
                <RightRailChat inDrawer />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
