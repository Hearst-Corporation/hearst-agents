"use client";

import { AnimatePresence, motion } from "framer-motion";
import { type CSSProperties, type ReactNode, useRef } from "react";

interface BentoCardProps {
  show?: boolean;
  children: ReactNode;
  /** Span de colonnes dans la grille (1-4) */
  colSpan?: 1 | 2 | 3 | 4;
  /** Span de rangées (1-3) */
  rowSpan?: 1 | 2 | 3;
  /** Délai d'apparition pour stagger */
  delay?: number;
  className?: string;
  style?: CSSProperties;
}

const TILT_INTENSITY = 18;

/**
 * Bento card glass — primitive de base pour les panels spatial.
 * Tilt 3D mouse-follow sur hover, glass blur + halo discret.
 */
export function BentoCard({
  show = true,
  children,
  colSpan = 1,
  rowSpan = 1,
  delay = 0,
  className,
  style,
}: BentoCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const rotateX = (y - rect.height / 2) / TILT_INTENSITY;
    const rotateY = (rect.width / 2 - x) / TILT_INTENSITY;
    el.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;
  }

  function handleLeave() {
    const el = ref.current;
    if (!el) return;
    el.style.transform = "perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px)";
  }

  const gridClass = [
    colSpan === 2 && "col-span-2",
    colSpan === 3 && "col-span-3",
    colSpan === 4 && "col-span-4",
    rowSpan === 2 && "row-span-2",
    rowSpan === 3 && "row-span-3",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96, filter: "blur(8px)" }}
          animate={{
            opacity: 1,
            scale: 1,
            filter: "blur(0px)",
            transition: { duration: 1.1, ease: [0.16, 1, 0.3, 1], delay },
          }}
          exit={{
            opacity: 0,
            scale: 0.97,
            filter: "blur(6px)",
            transition: { duration: 0.5, ease: [0.4, 0, 1, 1] },
          }}
          className={`pointer-events-auto ${gridClass} ${className ?? ""}`}
          style={style}
        >
          <div
            ref={ref}
            onMouseMove={handleMove}
            onMouseLeave={handleLeave}
            className="relative h-full w-full overflow-hidden rounded-[32px] p-7 transition-[transform,background,border-color] duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] hover:border-white/25"
            style={{
              background: "rgba(255,255,255,0.05)",
              backdropFilter: "blur(22px) saturate(130%)",
              WebkitBackdropFilter: "blur(22px) saturate(130%)",
              border: "1px solid rgba(255,255,255,0.10)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 12px 32px -16px rgba(0,0,0,0.5)",
              transformStyle: "preserve-3d",
              willChange: "transform",
            }}
          >
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
