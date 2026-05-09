"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { RunEvent } from "@/lib/events/types";
import { useCanvasStore } from "./store";
import type { NodeId } from "./topology";

interface PersistedEvent {
  type: string;
  ts: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: Record<string, any>;
}

export interface ReplayController {
  isPlaying: boolean;
  progress: number;
  speed: number;
  playToggle: () => void;
  setSpeed: (speed: number) => void;
  reset: () => void;
  seek: (progress: number) => void;
}

/** Délai de base par événement en ms (à 1×). */
const BASE_DELAY_MS = 500;

/**
 * Reproduction minimale de applyEventToStore sans dépendance circulaire.
 * Mirror du mapping dans use-event-stream.ts — à synchroniser si le mapping évolue.
 */
function applyReplayEvent(ev: PersistedEvent, store: ReturnType<typeof useCanvasStore.getState>): void {
  const setN = (id: NodeId, s: "idle" | "active" | "success" | "failed" | "blocked" | "disabled") =>
    store.setNodeState(id, s);

  switch (ev.type as RunEvent["type"]) {
    case "run_created":
      setN("entry", "active");
      break;
    case "run_started":
      setN("entry", "success");
      setN("router", "active");
      store.emitPacket("e_entry_router");
      break;
    case "run_completed":
      setN("complete", "success");
      break;
    case "run_failed":
      setN("complete", "failed");
      break;
    case "run_aborted":
    case "run_cancelled":
      setN("complete", "blocked");
      break;
    case "tool_call_started":
      setN("tools", "active");
      store.emitPacket("e_preflight_tools");
      break;
    case "tool_call_completed":
      setN("tools", "success");
      break;
    case "delegate_enqueued":
      setN("agent", "active");
      store.emitPacket("e_preflight_agent");
      break;
    case "delegate_completed":
      setN("agent", "success");
      break;
    case "plan_attached":
    case "plan_preview":
      setN("preflight", "active");
      break;
    case "plan_step_completed":
    case "plan_run_complete":
      setN("preflight", "success");
      break;
    default:
      return;
  }
  store.setLastEventAt(ev.ts || Date.now());
}

export function useReplay(events: PersistedEvent[]): ReplayController {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeedState] = useState(1);

  // Refs pour l'état mutable qui ne doit pas déclencher de re-render
  const posRef = useRef(0); // index du prochain événement à appliquer
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const eventsRef = useRef(events);
  const speedRef = useRef(speed);
  const isPlayingRef = useRef(false);

  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  const applyUpToIndex = useCallback((idx: number) => {
    const store = useCanvasStore.getState();
    store.resetNodes();
    const evs = eventsRef.current;
    for (let i = 0; i <= idx && i < evs.length; i++) {
      applyReplayEvent(evs[i], store);
    }
    posRef.current = idx + 1;
    const total = evs.length;
    const p = total <= 1 ? 1 : idx / (total - 1);
    setProgress(p);
  }, []);

  const stopInterval = useCallback(() => {
    if (intervalRef.current != null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startInterval = useCallback(() => {
    stopInterval();
    const delay = BASE_DELAY_MS / speedRef.current;
    intervalRef.current = setInterval(() => {
      const evs = eventsRef.current;
      const pos = posRef.current;
      if (pos >= evs.length) {
        // Fin du replay
        stopInterval();
        isPlayingRef.current = false;
        setIsPlaying(false);
        return;
      }
      applyReplayEvent(evs[pos], useCanvasStore.getState());
      posRef.current = pos + 1;
      const p = evs.length <= 1 ? 1 : (pos) / (evs.length - 1);
      setProgress(p);
    }, delay);
  }, [stopInterval, applyReplayEvent]);

  const playToggle = useCallback(() => {
    if (isPlayingRef.current) {
      isPlayingRef.current = false;
      setIsPlaying(false);
      stopInterval();
    } else {
      if (posRef.current >= eventsRef.current.length) {
        // Rembobinage auto si on est à la fin
        posRef.current = 0;
        useCanvasStore.getState().resetNodes();
        setProgress(0);
      }
      isPlayingRef.current = true;
      setIsPlaying(true);
      startInterval();
    }
  }, [stopInterval, startInterval]);

  const setSpeed = useCallback((s: number) => {
    speedRef.current = s;
    setSpeedState(s);
    if (isPlayingRef.current) {
      startInterval(); // relance avec le nouveau délai
    }
  }, [startInterval]);

  const reset = useCallback(() => {
    stopInterval();
    isPlayingRef.current = false;
    setIsPlaying(false);
    posRef.current = 0;
    setProgress(0);
    useCanvasStore.getState().resetNodes();
  }, [stopInterval]);

  const seek = useCallback((p: number) => {
    const evs = eventsRef.current;
    if (!evs.length) return;
    const idx = Math.round(p * (evs.length - 1));
    applyUpToIndex(idx);
  }, [applyUpToIndex]);

  // Nettoyage à l'unmount
  useEffect(() => () => { stopInterval(); }, [stopInterval]);

  // Reset si la liste d'events change (nouveau run sélectionné)
  useEffect(() => {
    stopInterval();
    isPlayingRef.current = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsPlaying(false);
    posRef.current = 0;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProgress(0);
  }, [events, stopInterval]);

  return { isPlaying, progress, speed, playToggle, setSpeed, reset, seek };
}
