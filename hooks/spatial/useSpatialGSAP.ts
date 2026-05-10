"use client";

import { useRef, useEffect } from "react";
import { gsap } from "gsap";

/**
 * Hook GSAP avec nettoyage automatique du contexte.
 * Le callback reçoit un gsap.Context pour enregistrer les animations.
 */
export function useSpatialGSAP(
  callback: (ctx: gsap.Context) => void,
  deps: React.DependencyList = []
) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const ctx = gsap.context(callback, ref);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return ref;
}

/**
 * Anime un élément au mount avec les presets GSAP.
 */
export function useSpatialEmerge(
  active = true,
  vars?: gsap.TweenVars
) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active || !ref.current) return;
    const tween = gsap.from(ref.current, {
      opacity: 0,
      scale: 0.92,
      filter: "blur(16px)",
      duration: 1.2,
      ease: "power3.out",
      ...vars,
    });
    return () => { tween.kill(); };
  }, [active]);  // eslint-disable-line react-hooks/exhaustive-deps

  return ref;
}
