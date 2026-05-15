"use client";

import { MotionConfig } from "framer-motion";
import { createContext, type ReactNode, useContext } from "react";

interface SpatialMotionContextType {
  reducedMotion: boolean;
}

const SpatialMotionContext = createContext<SpatialMotionContextType>({
  reducedMotion: false,
});

export const useSpatialMotion = () => useContext(SpatialMotionContext);

export function SpatialMotionProvider({ children }: { children: ReactNode }) {
  return (
    <SpatialMotionContext.Provider value={{ reducedMotion: false }}>
      <MotionConfig
        transition={{
          type: "spring",
          stiffness: 100,
          damping: 20,
          mass: 1,
        }}
      >
        {children}
      </MotionConfig>
    </SpatialMotionContext.Provider>
  );
}
