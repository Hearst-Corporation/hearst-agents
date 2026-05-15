"use client";

/**
 * useSplineIdleAmbient — pousse une variable `idle_intensity` (0..1) dans
 * la scène Spline quand l'app est idle depuis > 30s.
 *
 * Quand `coreState === 'idle'` ET `voicePhase === 'idle'` se maintient
 * 30s, on monte progressivement `idle_intensity` de 0 → 0.3 sur 1.5s.
 * Toute interaction (event SSE, transition voice) reset à 0.
 *
 * Permet à la scène de jouer une anim ambient (rotation lente robot ou
 * halo doux) sans intervention.
 */

import { useEffect, useRef } from "react";
import { useRuntimeStore } from "@/stores/runtime";
import { useVoiceStore } from "@/stores/voice";
import type { UseSplineApp } from "./useSplineApp";

const IDLE_DELAY_MS = 30_000;
const TARGET_INTENSITY = 0.3;
const RAMP_MS = 1_500;

export function useSplineIdleAmbient(spline: UseSplineApp) {
  const coreState = useRuntimeStore((s) => s.coreState);
  const voicePhase = useVoiceStore((s) => s.phase);
  const intensityRef = useRef(0);
  const rampStartRef = useRef<number | null>(null);

  useEffect(() => {
    const isIdle = coreState === "idle" && voicePhase === "idle";

    if (!isIdle) {
      // Reset immédiat
      if (intensityRef.current !== 0) {
        intensityRef.current = 0;
        spline.setVar("idle_intensity", 0);
      }
      rampStartRef.current = null;
      return;
    }

    const idleStart = Date.now();
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const elapsed = Date.now() - idleStart;
      if (elapsed < IDLE_DELAY_MS) return;
      if (rampStartRef.current === null) rampStartRef.current = Date.now();
      const rampElapsed = Date.now() - rampStartRef.current;
      const progress = Math.min(1, rampElapsed / RAMP_MS);
      const value = TARGET_INTENSITY * progress;
      if (Math.abs(value - intensityRef.current) > 0.005) {
        intensityRef.current = value;
        spline.setVar("idle_intensity", value);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [coreState, voicePhase, spline]);
}
