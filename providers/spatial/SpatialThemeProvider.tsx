"use client";

import { createContext, type ReactNode, useContext } from "react";
import { SPATIAL_THEME_DARK } from "@/lib/spatial/constants";

interface SpatialThemeContextType {
  isDark: boolean;
  accentColor: string;
  theme: typeof SPATIAL_THEME_DARK;
}

const SpatialThemeContext = createContext<SpatialThemeContextType>({
  isDark: true,
  accentColor: "#ffffff",
  theme: SPATIAL_THEME_DARK,
});

export const useSpatialTheme = () => useContext(SpatialThemeContext);

export function SpatialThemeProvider({ children }: { children: ReactNode }) {
  return (
    <SpatialThemeContext.Provider
      value={{ isDark: true, accentColor: "#ffffff", theme: SPATIAL_THEME_DARK }}
    >
      {children}
    </SpatialThemeContext.Provider>
  );
}
