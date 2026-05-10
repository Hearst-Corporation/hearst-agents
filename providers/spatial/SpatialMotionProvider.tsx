"use client";

import { createContext, useContext, useRef, useEffect, type ReactNode } from "react";
import { gsap } from "gsap";

interface SpatialMotionContextValue {
  gsap: typeof gsap;
  timeline: (vars?: gsap.TimelineVars) => gsap.core.Timeline;
  emerge: (target: gsap.TweenTarget, vars?: gsap.TweenVars) => gsap.core.Tween;
  dissolve: (target: gsap.TweenTarget, vars?: gsap.TweenVars) => gsap.core.Tween;
  pulse: (target: gsap.TweenTarget, vars?: gsap.TweenVars) => gsap.core.Tween;
}

const SpatialMotionContext = createContext<SpatialMotionContextValue | null>(null);

export function SpatialMotionProvider({ children }: { children: ReactNode }) {
  const masterRef = useRef<gsap.core.Timeline | null>(null);

  useEffect(() => {
    masterRef.current = gsap.timeline({ paused: true });
    return () => {
      masterRef.current?.kill();
    };
  }, []);

  function emerge(target: gsap.TweenTarget, vars?: gsap.TweenVars) {
    return gsap.from(target, {
      opacity: 0,
      scale: 0.9,
      filter: "blur(20px)",
      duration: 1.2,
      ease: "power3.out",
      ...vars,
    });
  }

  function dissolve(target: gsap.TweenTarget, vars?: gsap.TweenVars) {
    return gsap.to(target, {
      opacity: 0,
      scale: 0.95,
      filter: "blur(10px)",
      duration: 0.8,
      ease: "power2.inOut",
      ...vars,
    });
  }

  function pulse(target: gsap.TweenTarget, vars?: gsap.TweenVars) {
    return gsap.to(target, {
      scale: 1.05,
      repeat: -1,
      yoyo: true,
      duration: 1.5,
      ease: "power1.inOut",
      ...vars,
    });
  }

  const value: SpatialMotionContextValue = {
    gsap,
    timeline: (vars) => gsap.timeline(vars),
    emerge,
    dissolve,
    pulse,
  };

  return (
    <SpatialMotionContext.Provider value={value}>
      {children}
    </SpatialMotionContext.Provider>
  );
}

export function useSpatialMotion() {
  const ctx = useContext(SpatialMotionContext);
  if (!ctx) throw new Error("useSpatialMotion must be used within SpatialMotionProvider");
  return ctx;
}
