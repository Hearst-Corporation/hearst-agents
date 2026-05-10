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
      }, 300);
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
            initial={{ opacity: 0, y: 20, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: 10, filter: "blur(4px)" }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="flex gap-4 mb-8 pointer-events-auto"
          >
            {suggestions.map((suggestion, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setValue(suggestion);
                  setTimeout(() => handleSubmit({ preventDefault: () => {} } as React.FormEvent), 100);
                }}
                className="px-5 py-2 rounded-full bg-white/5 border border-white/10 text-white/50 hover:bg-white/10 hover:text-white/90 transition-all duration-500 backdrop-blur-md text-xs font-light tracking-wide"
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
            initial={{ opacity: 0, y: 40, scale: 0.95, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: 20, scale: 0.95, filter: "blur(10px)" }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
            className="w-full max-w-2xl px-6 pointer-events-auto"
          >
            <form onSubmit={handleSubmit} className="relative group">
              <div className="absolute -inset-0.5 bg-linear-to-r from-white/0 via-white/10 to-white/0 rounded-full blur opacity-0 group-focus-within:opacity-100 transition-opacity duration-1000" />
              <div className="relative flex items-center bg-[var(--bg-elev)]/80 border border-white/10 rounded-full backdrop-blur-2xl shadow-2xl overflow-hidden transition-colors duration-500 group-focus-within:border-white/20 group-focus-within:bg-black/90">
                <div className="pl-6 pr-4 text-white/40">
                  ✧
                </div>
                <input
                  ref={inputRef}
                  type="text"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="Que souhaitez-vous orchestrer ?"
                  className="w-full bg-transparent border-none outline-none text-white/90 placeholder:text-white/30 py-5 text-sm font-light tracking-wide focus:ring-0"
                />
                <button
                  type="submit"
                  disabled={!value.trim()}
                  className="pr-6 pl-4 text-white/30 hover:text-white transition-colors disabled:opacity-50 disabled:hover:text-white/30"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
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
