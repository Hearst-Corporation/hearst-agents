"use client";

/**
 * useSplineVoiceBridge — pousse `voiceStore.audioLevel` (0..1) dans la scène
 * Spline à 60 fps, sans subscribe React.
 *
 * Pourquoi RAF + getState() : `audioLevel` change à 60 Hz (RMS du mic).
 * Si on subscribait via `useVoiceStore(s => s.audioLevel)`, on déclencherait
 * un re-render React 60×/s → mort. On lit directement le state Zustand depuis
 * une RAF, ce qui n'engage zero React reconciliation.
 *
 * Stratégie de bind :
 *  - Variable `pulse` (0..1) côté Spline (Variables panel) — préférée si dispo
 *  - Fallback : mute `Orb.scale` directement de 1 à 1.18 si l'objet existe
 *  - Si rien de tout ça : no-op silencieux, l'app reste fonctionnelle
 */

import { useEffect } from "react";
import { useVoiceStore } from "@/stores/voice";
import type { UseSplineApp } from "./useSplineApp";

const PULSE_SCALE_MIN = 1;
const PULSE_SCALE_AMP = 0.18;

export function useSplineVoiceBridge(spline: UseSplineApp) {
  useEffect(() => {
    let raf = 0;
    let lastLevel = -1;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!spline.ready.current) return;

      const level = useVoiceStore.getState().audioLevel;
      // Skip si pas changé (épargne setVariable + mut threejs)
      if (Math.abs(level - lastLevel) < 0.005) return;
      lastLevel = level;

      // Variable Spline canonique : `pulse` (0..1)
      spline.setVar("pulse", level);

      // Fallback : mute scale direct sur l'objet `Orb`
      const orb = spline.obj("Orb");
      if (orb) {
        const s = PULSE_SCALE_MIN + level * PULSE_SCALE_AMP;
        orb.scale.x = s;
        orb.scale.y = s;
        orb.scale.z = s;
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [spline]);
}
