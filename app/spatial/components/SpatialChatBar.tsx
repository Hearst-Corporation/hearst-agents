"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useEffect } from "react";

interface SpatialChatBarProps {
  stage: "idle" | "focus" | "mission" | "asset";
  onSubmit: (text: string) => void;
}

export function SpatialChatBar({ stage, onSubmit }: SpatialChatBarProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = [
    "Analyser les KPIs du trimestre",
    "Préparer le briefing de 10h",
    "Résumer les derniers échanges Slack",
  ];

  useEffect(() => {
    if (stage === "focus" && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 500); // Slower, calmer appearance
    }
  }, [stage]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onSubmit(value);
      setValue("");
    }
  };

  return (
    <div className="absolute inset-x-0 bottom-0 pointer-events-none z-20 flex flex-col items-center justify-end pb-16">
      <AnimatePresence>
        {stage === "focus" && (
          <motion.div
            initial={{ opacity: 0, y: 10, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: 5, filter: "blur(8px)" }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="flex gap-3 mb-8 pointer-events-auto"
          >
            {suggestions.map((suggestion, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setValue(suggestion);
                  setTimeout(() => handleSubmit({ preventDefault: () => {} } as React.FormEvent), 150);
                }}
                className="px-5 py-2.5 rounded-full bg-white/[0.02] border border-white/[0.05] text-white/40 hover:bg-white/[0.08] hover:text-white/80 hover:border-white/[0.1] transition-all duration-700 backdrop-blur-md text-[11px] font-light tracking-[0.05em] shadow-[0_4px_24px_rgba(0,0,0,0.4)]"
              >
                {suggestion}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {stage === "focus" && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98, filter: "blur(12px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: 10, scale: 0.98, filter: "blur(12px)" }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
            className="w-full max-w-2xl px-6 pointer-events-auto"
          >
            <form onSubmit={handleSubmit} className="relative group">
              <div className="absolute -inset-1 bg-linear-to-r from-white/0 via-white/[0.08] to-white/0 rounded-[2rem] blur-md opacity-0 group-focus-within:opacity-100 transition-opacity duration-1000" />
              <div className="relative flex items-center bg-black/40 border border-white/[0.08] rounded-[2rem] backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.6)] overflow-hidden transition-all duration-700 group-focus-within:border-white/[0.15] group-focus-within:bg-black/60">
                <div className="pl-6 pr-3 text-white/30 group-focus-within:text-white/60 transition-colors duration-700">
                  <span className="text-xl font-light">✧</span>
                </div>
                <input
                  ref={inputRef}
                  type="text"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="Que souhaitez-vous orchestrer ?"
                  className="w-full bg-transparent border-none outline-none text-white/90 placeholder:text-white/20 py-5 text-sm font-light tracking-wide focus:ring-0"
                />
                <button
                  type="submit"
                  disabled={!value.trim()}
                  className="pr-6 pl-4 text-white/20 hover:text-white/80 transition-colors duration-500 disabled:opacity-30 disabled:hover:text-white/20"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="19" x2="12" y2="5"></line>
                    <polyline points="5 12 12 5 19 12"></polyline>
                  </svg>
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
