"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { SpatialTheme } from "@/lib/spatial/types";
import { SPATIAL_THEME_DARK } from "@/lib/spatial/constants";

interface SpatialThemeContextValue {
  theme: SpatialTheme;
  setTheme: (theme: Partial<SpatialTheme>) => void;
}

const SpatialThemeContext = createContext<SpatialThemeContextValue | null>(null);

export function SpatialThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<SpatialTheme>(SPATIAL_THEME_DARK);

  function setTheme(overrides: Partial<SpatialTheme>) {
    setThemeState((prev) => ({ ...prev, ...overrides }));
  }

  return (
    <SpatialThemeContext.Provider value={{ theme, setTheme }}>
      <div
        style={
          {
            "--sp-bg": theme.background,
            "--sp-surface": theme.surface,
            "--sp-surface-high": theme.surfaceHigh,
            "--sp-text": theme.text,
            "--sp-text-muted": theme.textMuted,
            "--sp-accent": theme.accent,
            "--sp-accent-glow": theme.accentGlow,
            "--sp-border": theme.border,
            "--sp-border-high": theme.borderHigh,
          } as React.CSSProperties
        }
      >
        {children}
      </div>
    </SpatialThemeContext.Provider>
  );
}

export function useSpatialTheme() {
  const ctx = useContext(SpatialThemeContext);
  if (!ctx) throw new Error("useSpatialTheme must be used within SpatialThemeProvider");
  return ctx;
}
