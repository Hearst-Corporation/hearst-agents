"use client";

import { useEffect, useMemo, useState } from "react";

interface MiniChartProps {
  /** Nombre de barres (12 par défaut) */
  bars?: number;
  /** Intervalle d'animation en ms (3000 par défaut). Ignoré si `heights` fourni. */
  intervalMs?: number;
  /** Si fourni, désactive l'anim random et affiche les hauteurs réelles. */
  heights?: number[];
  className?: string;
}

function randomHeights(count: number) {
  return Array.from({ length: count }, () => 10 + Math.random() * 90);
}

/**
 * Mini graphique à barres.
 * - Si `heights` fourni : affiche les valeurs réelles, padding-left si < bars.
 * - Sinon : régénère des hauteurs random toutes les `intervalMs`.
 */
export function MiniChart({ bars = 12, intervalMs = 3000, heights, className }: MiniChartProps) {
  const [randomBars, setRandomBars] = useState<number[]>(() => randomHeights(bars));

  const useRandom = heights === undefined;

  useEffect(() => {
    if (!useRandom) return;
    const id = setInterval(() => {
      setRandomBars(randomHeights(bars));
    }, intervalMs);
    return () => clearInterval(id);
  }, [bars, intervalMs, useRandom]);

  const values = useMemo(() => {
    if (useRandom) return randomBars;
    if (heights.length >= bars) return heights.slice(-bars);
    // Pad-left avec 0 pour aligner à droite (les valeurs récentes en fin)
    return [...Array(bars - heights.length).fill(0), ...heights];
  }, [useRandom, randomBars, heights, bars]);

  return (
    <div className={`flex h-[60px] items-end gap-1 ${className ?? ""}`}>
      {values.map((h, i) => (
        <div
          key={i}
          className="flex-1 rounded-[2px] transition-[height] duration-1000 ease-out"
          style={{
            height: `${Math.max(2, h)}%`,
            background: "rgba(255,255,255,0.6)",
            opacity: h > 0 ? 0.35 : 0.08,
          }}
        />
      ))}
    </div>
  );
}
