'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useSpatialMouseContext } from '@/providers/spatial-safe/SpatialMouseProvider';

interface OrbitalItemProps {
  label: string;
  value: string;
  delay?: number;
  x: number;
  y: number;
  active?: boolean;
}

export function OrbitalItem({ label, value, delay = 0, x, y, active = false }: OrbitalItemProps) {
  const { smoothX, smoothY } = useSpatialMouseContext();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{
        opacity: 1,
      }}
      transition={{
        opacity: { delay, duration: 1.5 },
      }}
      style={{
        left: `${x}%`,
        top: `${y}%`,
      }}
      className="absolute pointer-events-auto group"
    >
      <motion.div
        style={{
          x: smoothX,
          y: smoothY,
        }}
        className="flex items-center gap-3"
      >
        {/* Connection Line to Center (abstract) */}
        <div className="absolute -left-4 top-1/2 w-4 h-px bg-linear-to-r from-transparent to-white/10" />

        <div className={`w-1 h-1 rounded-full ${active ? 'bg-cyan-400 shadow-[0_0_8px_rgba(0,229,255,0.6)]' : 'bg-white/20'} group-hover:bg-white transition-all duration-500`} />

        <div className="flex flex-col">
          <span className="spatial-text-muted text-spatial-xs uppercase tracking-[0.15em] font-light group-hover:text-white/60 transition-colors">{label}</span>
          <span className="spatial-text-pure text-spatial-md font-light group-hover:translate-x-0.5 transition-transform duration-500">{value}</span>
        </div>
      </motion.div>
    </motion.div>
  );
}
