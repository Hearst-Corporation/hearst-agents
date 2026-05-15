"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";

interface SpatialLogoInteractionProps {
  children: ReactNode;
}

/**
 * Wrapper client autour de la scène Spline.
 * Clic = toggle Look At ON/OFF.
 * Quand OFF, on bloque pointermove/mousemove en capture pour empêcher
 * le canvas Spline de tracker le curseur.
 */
export function SpatialLogoInteraction({ children }: SpatialLogoInteractionProps) {
  const [isActive, setIsActive] = useState(true);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    function block(e: Event) {
      if (!isActive) e.stopPropagation();
    }

    wrapper.addEventListener("pointermove", block, true);
    wrapper.addEventListener("mousemove", block, true);

    return () => {
      wrapper.removeEventListener("pointermove", block, true);
      wrapper.removeEventListener("mousemove", block, true);
    };
  }, [isActive]);

  return (
    <div
      ref={wrapperRef}
      onClick={() => setIsActive((v) => !v)}
      className="absolute inset-0 w-full h-full cursor-pointer"
      title={isActive ? "Cliquez pour figer le robot" : "Cliquez pour activer le robot"}
    >
      {children}
    </div>
  );
}
