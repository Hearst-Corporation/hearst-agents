'use client';

import { useEffect, useState } from 'react';

interface MiniChartProps {
  /** Nombre de barres (12 par défaut) */
  bars?: number;
  /** Intervalle d'animation en ms (3000 par défaut) */
  intervalMs?: number;
  className?: string;
}

function randomHeights(count: number) {
  return Array.from({ length: count }, () => 10 + Math.random() * 90);
}

/**
 * Mini graphique à barres animées.
 * Régénère des hauteurs random toutes les `intervalMs`.
 */
export function MiniChart({ bars = 12, intervalMs = 3000, className }: MiniChartProps) {
  const [heights, setHeights] = useState<number[]>(() => randomHeights(bars));

  useEffect(() => {
    const id = setInterval(() => {
      setHeights(randomHeights(bars));
    }, intervalMs);
    return () => clearInterval(id);
  }, [bars, intervalMs]);

  return (
    <div className={`flex h-[60px] items-end gap-1 ${className ?? ''}`}>
      {heights.map((h, i) => (
        <div
          key={i}
          className="flex-1 rounded-[2px] transition-[height] duration-1000 ease-out"
          style={{
            height: `${h}%`,
            background: 'rgba(255,255,255,0.6)',
            opacity: 0.35,
          }}
        />
      ))}
    </div>
  );
}
