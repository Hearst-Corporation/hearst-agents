"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSpatialMouseContext } from "@/providers/spatial/SpatialMouseProvider";
import { useTransform } from "framer-motion";
import { SPATIAL_Z_LAYERS } from "@/lib/spatial/constants";

interface CommandBarProps {
  show: boolean;
  /** Si true, force le focus à l'apparition */
  autoFocus?: boolean;
  /** Appelé quand l'utilisateur soumet une intention */
  onSubmit: (text: string) => void;
}

/**
 * Barre de commande utilisable.
 * - input réel, placeholder explicite
 * - bouton envoyer visible
 * - Enter déclenche onSubmit
 * - parallax doux via SpatialMouseContext (cohérent avec FloatingPanel)
 */
export function CommandBar({ show, autoFocus = true, onSubmit }: CommandBarProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const { smoothX, smoothY } = useSpatialMouseContext();
  const rotateX = useTransform(smoothY, [-1, 1], [1.2, -1.2]);
  const rotateY = useTransform(smoothX, [-1, 1], [-1.2, 1.2]);

  useEffect(() => {
    if (show && autoFocus && inputRef.current) {
      const id = setTimeout(() => inputRef.current?.focus(), 280);
      return () => clearTimeout(id);
    }
  }, [show, autoFocus]);

  function handleSubmit(e?: FormEvent) {
    e?.preventDefault();
    const text = value.trim();
    if (!text) return;
    onSubmit(text);
    setValue("");
  }

  const canSubmit = value.trim().length > 0;

  return (
    <div
      className="absolute inset-x-0 bottom-8 flex items-center justify-center pointer-events-none md:[perspective:1400px]"
      style={{ zIndex: SPATIAL_Z_LAYERS.surface }}
    >
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: 32, scale: 0.96, filter: "blur(14px)" }}
            animate={{
              opacity: 1, y: 0, scale: 1, filter: "blur(0px)",
              transition: { duration: 1.4, ease: [0.16, 1, 0.3, 1], delay: 0.45 },
            }}
            exit={{
              opacity: 0, y: 16, scale: 0.97, filter: "blur(8px)",
              transition: { duration: 0.6, ease: [0.4, 0, 1, 1] },
            }}
            style={{ rotateX, rotateY }}
            className="pointer-events-auto w-full max-w-[560px] px-6"
          >
            <form onSubmit={handleSubmit} className="relative">
              <div
                className="relative flex items-center overflow-hidden rounded-[32px] transition-colors"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  backdropFilter: "blur(22px) saturate(130%)",
                  WebkitBackdropFilter: "blur(22px) saturate(130%)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 12px 32px -16px rgba(0,0,0,0.5)",
                }}
              >
                {/* Glyphe gauche */}
                <div className="pl-7 pr-3 text-white/40 text-spatial-xl leading-none select-none">
                  ✦
                </div>

                <input
                  ref={inputRef}
                  type="text"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="Demandez à Hearst…"
                  aria-label="Demande à Hearst"
                  className="flex-1 bg-transparent border-none outline-none text-white/95 placeholder:text-white/35 py-5 text-spatial-xl font-light tracking-wide focus:ring-0"
                />

                <button
                  type="submit"
                  disabled={!canSubmit}
                  aria-label="Envoyer"
                  className="mr-3 my-2 rounded-[20px] px-5 py-2 text-spatial-base font-light uppercase tracking-[0.18em] transition-all duration-300 disabled:cursor-not-allowed"
                  style={
                    canSubmit
                      ? {
                          background: "rgba(255,255,255,0.12)",
                          color: "rgba(255,255,255,0.9)",
                          border: "1px solid rgba(255,255,255,0.16)",
                        }
                      : {
                          background: "rgba(255,255,255,0.04)",
                          color: "rgba(255,255,255,0.4)",
                          border: "1px solid rgba(255,255,255,0.08)",
                        }
                  }
                >
                  Envoyer
                </button>
              </div>

              {/* Hint Enter */}
              <div className="mt-3 flex items-center justify-center gap-2 text-white/30 text-spatial-sm tracking-[0.32em] uppercase font-light">
                <span>Entrée</span>
                <span className="opacity-60">pour orchestrer</span>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
