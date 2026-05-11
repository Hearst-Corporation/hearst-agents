'use client';

import React, { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSpatialMouseContext } from '@/providers/spatial-safe/SpatialMouseProvider';

interface FloatingPanelProps {
  title?: string;
  children: ReactNode;
  anchor?: 'left' | 'right' | 'center' | 'bottom-center';
  delay?: number;
  show?: boolean;
  width?: number;
}

export function FloatingPanel({
  title,
  children,
  anchor = 'center',
  delay = 0,
  show = true,
  width = 320
}: FloatingPanelProps) {
  const { smoothX, smoothY } = useSpatialMouseContext();

  const anchorClasses = {
    left: 'left-4 md:left-12 top-1/2 -translate-y-1/2',
    right: 'right-4 md:right-12 top-1/2 -translate-y-1/2',
    center: 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
    'bottom-center': 'left-1/2 bottom-4 md:bottom-12 -translate-x-1/2',
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{
            opacity: 0,
            scale: 0.95,
            x: anchor === 'left' ? -10 : anchor === 'right' ? 10 : 0,
            y: anchor === 'bottom-center' ? 10 : 0
          }}
          animate={{
            opacity: 1,
            scale: 1,
            x: 0,
            y: 0
          }}
          exit={{
            opacity: 0,
            scale: 0.95,
            transition: { duration: 0.3 }
          }}
          transition={{ delay, duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          className={`absolute ${anchorClasses[anchor]} pointer-events-auto max-w-[85vw]`}
          style={{
            width: `min(${width}px, 85vw)`,
            translateX: anchor === 'center' ? '-50%' : 0,
            translateY: (anchor === 'center' || anchor === 'left' || anchor === 'right') ? '-50%' : 0,
          }}
        >
          <motion.div
            style={{
              x: smoothX,
              y: smoothY,
            }}
            className="spatial-immaterial-panel"
          >
            {title && (
              <div className="flex justify-between items-center mb-4 px-4 md:px-6 pt-4 md:pt-6">
                <h3 className="spatial-text-muted text-spatial-sm uppercase tracking-[0.2em] font-light">{title}</h3>
                <div className="w-1 h-1 rounded-full bg-white/10" />
              </div>
            )}
            <div className={title ? "px-4 md:px-6 pb-4 md:pb-6" : ""}>
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
