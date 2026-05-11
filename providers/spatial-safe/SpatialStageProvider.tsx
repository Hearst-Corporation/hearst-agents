"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { SpatialStage } from "@/lib/spatial-safe/types";

interface SpatialStageContextValue {
  stage: SpatialStage;
  previousStage: SpatialStage | null;
  setStage: (stage: SpatialStage) => void;
  transitionTo: (stage: SpatialStage, delayMs?: number) => void;
  isTransitioning: boolean;
}

const SpatialStageContext = createContext<SpatialStageContextValue | null>(null);

export function SpatialStageProvider({
  children,
  initialStage = "idle",
}: {
  children: ReactNode;
  initialStage?: SpatialStage;
}) {
  const [stage, setStageState] = useState<SpatialStage>(initialStage);
  const [previousStage, setPreviousStage] = useState<SpatialStage | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const setStage = useCallback((next: SpatialStage) => {
    setPreviousStage((prev) => (prev !== next ? stage : prev));
    setStageState(next);
  }, [stage]);

  const transitionTo = useCallback((next: SpatialStage, delayMs = 0) => {
    setIsTransitioning(true);
    setStageState("transition");
    setTimeout(() => {
      setPreviousStage(stage);
      setStageState(next);
      setIsTransitioning(false);
    }, delayMs);
  }, [stage]);

  return (
    <SpatialStageContext.Provider
      value={{ stage, previousStage, setStage, transitionTo, isTransitioning }}
    >
      {children}
    </SpatialStageContext.Provider>
  );
}

export function useSpatialStage() {
  const ctx = useContext(SpatialStageContext);
  if (!ctx) throw new Error("useSpatialStage must be used within SpatialStageProvider");
  return ctx;
}
