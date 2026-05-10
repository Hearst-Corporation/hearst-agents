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

  // Very subtle rotation (max 3 degrees) for a premium, heavy glass feel
  const rotateX = useTransform(mouseY, [-1, 1], [3, -3]);
  const rotateY = useTransform(mouseX, [-1, 1], [-3, 3]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Normalize mouse position between -1 and 1
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
    <div className="absolute inset-0 pointer-events-none z-20 flex items-center justify-center" style={{ perspective: "1200px" }}>
      <AnimatePresence>
        {stage === "asset" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, z: -100, filter: "blur(20px)" }}
            animate={{ opacity: 1, scale: 1, z: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.95, z: -50, filter: "blur(10px)" }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            style={{ rotateX, rotateY }}
            className="pointer-events-auto relative w-[600px] max-w-[90vw] bg-[var(--bg)]/60 border border-white/10 rounded-2xl p-10 backdrop-blur-3xl shadow-[0_0_80px_rgba(0,0,0,0.8)]"
          >
            {/* Subtle glass reflection */}
            <div className="absolute inset-0 rounded-2xl bg-linear-to-br from-white/5 to-transparent pointer-events-none" />

            <button 
              onClick={onClose}
              className="absolute top-6 right-6 text-white/30 hover:text-white transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            
            <div className="flex items-center gap-4 mb-10">
              <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/80">
                ⚲
              </div>
              <div>
                <h3 className="text-white/90 text-lg font-light tracking-wide">Analyse Stratégique</h3>
                <p className="text-white/40 text-xs tracking-wider uppercase mt-1">Généré par l&apos;Agent Analyst</p>
              </div>
            </div>

            <div className="space-y-8 text-white/60 font-light leading-relaxed text-sm">
              <p>
                L&apos;orchestration de la mission a permis de consolider les données de marché.
                Les indicateurs clés montrent une progression stable sur le dernier trimestre, avec une accélération notable sur le segment B2B.
              </p>
              
              <div className="h-px w-full bg-linear-to-r from-transparent via-white/10 to-transparent" />
              
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-white/5 rounded-xl p-6 border border-white/5 relative overflow-hidden group">
                  <div className="absolute inset-0 bg-linear-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="text-white/40 text-xs tracking-widest uppercase mb-3">Croissance</div>
                  <div className="text-3xl text-white/90 font-light">+24%</div>
                </div>
                <div className="bg-white/5 rounded-xl p-6 border border-white/5 relative overflow-hidden group">
                  <div className="absolute inset-0 bg-linear-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="text-white/40 text-xs tracking-widest uppercase mb-3">Engagement</div>
                  <div className="text-3xl text-white/90 font-light">8.4s</div>
                </div>
              </div>
            </div>
            
            <div className="mt-10 flex justify-end">
              <button 
                onClick={onClose}
                className="px-8 py-3 rounded-full bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors tracking-wide"
              >
                Terminer
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
