"use client";

import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { useEffect } from "react";

interface AssetDisplayProps {
  stage: "idle" | "focus" | "mission" | "asset";
  onClose: () => void;
}

export function AssetDisplay({ stage, onClose }: AssetDisplayProps) {
  // Parallax physical effect
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Ultra-subtle rotation for a heavy, premium glass feel
  const rotateX = useTransform(mouseY, [-1, 1], [2, -2]);
  const rotateY = useTransform(mouseX, [-1, 1], [-2, 2]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = (e.clientY / window.innerHeight) * 2 - 1;
      mouseX.set(x);
      mouseY.set(y);
    };

    if (stage === "asset") {
      window.addEventListener("mousemove", handleMouseMove);
    }
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [stage, mouseX, mouseY]);

  return (
    <div className="absolute inset-0 pointer-events-none z-20 flex items-center justify-center" style={{ perspective: "2000px" }}>
      <AnimatePresence>
        {stage === "asset" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, z: -100, filter: "blur(20px)" }}
            animate={{ opacity: 1, scale: 1, z: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.98, z: -50, filter: "blur(10px)" }}
            transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
            style={{ rotateX, rotateY }}
            className="pointer-events-auto relative w-[600px] max-w-[90vw] rounded-3xl p-10 backdrop-blur-3xl shadow-[0_32px_80px_rgba(0,0,0,0.8)] overflow-hidden"
          >
            {/* Deep frosted glass background */}
            <div className="absolute inset-0 bg-black/20 pointer-events-none" />
            
            {/* Delicate border lighting */}
            <div className="absolute inset-0 rounded-3xl border border-white/[0.08] pointer-events-none mix-blend-overlay" />
            
            {/* Subtle inner reflection */}
            <div className="absolute inset-0 rounded-3xl bg-linear-to-br from-white/[0.05] via-transparent to-transparent pointer-events-none" />

            <button 
              onClick={onClose}
              className="absolute top-8 right-8 text-white/30 hover:text-white transition-colors duration-500 z-10"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            
            <div className="relative z-10 flex items-center gap-5 mb-12">
              <div className="w-12 h-12 rounded-full bg-white/[0.03] border border-white/[0.08] flex items-center justify-center text-white/80 shadow-inner">
                <span className="text-lg font-light">⚲</span>
              </div>
              <div>
                <h3 className="text-white/90 text-lg font-light tracking-wide">Analyse Stratégique</h3>
                <p className="text-white/40 text-[10px] tracking-[0.2em] uppercase mt-1.5">Agent Analyst — Terminé</p>
              </div>
            </div>

            <div className="relative z-10 space-y-10 text-white/60 font-light leading-relaxed text-sm">
              <p className="text-white/70">
                L&apos;orchestration de la mission a permis de consolider les données de marché.
                Les indicateurs clés montrent une progression stable sur le dernier trimestre, avec une accélération notable sur le segment B2B.
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/[0.02] rounded-2xl p-6 border border-white/[0.04] relative overflow-hidden group">
                  <div className="absolute inset-0 bg-linear-to-br from-white/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                  <div className="text-white/30 text-[10px] tracking-[0.2em] uppercase mb-4">Croissance</div>
                  <div className="text-4xl text-white/90 font-light tracking-tight">+24%</div>
                </div>
                <div className="bg-white/[0.02] rounded-2xl p-6 border border-white/[0.04] relative overflow-hidden group">
                  <div className="absolute inset-0 bg-linear-to-br from-white/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                  <div className="text-white/30 text-[10px] tracking-[0.2em] uppercase mb-4">Engagement</div>
                  <div className="text-4xl text-white/90 font-light tracking-tight">8.4s</div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
