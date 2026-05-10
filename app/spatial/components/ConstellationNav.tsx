"use client";

import { motion, AnimatePresence } from "framer-motion";

interface ConstellationNavProps {
  stage: "idle" | "focus" | "mission" | "asset";
  onHoverNode: (nodeId: string | null) => void;
}

export function ConstellationNav({ stage, onHoverNode }: ConstellationNavProps) {
  // Rayons de l'orbite
  const radiusX = 320;
  const radiusY = 240;

  const navNodes = [
    { id: "apps", label: "Connecteurs", position: "left", x: -radiusX, y: 0, delay: 0.1 },
    { id: "history", label: "Investigations", position: "right", x: radiusX, y: 0, delay: 0.2 },
    { id: "profile", label: "Espace Personnel", position: "top", x: 0, y: -radiusY, delay: 0.3 },
  ];

  return (
    <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
      <AnimatePresence>
        {stage === "focus" &&
          navNodes.map((node) => (
            <motion.div
              key={node.id}
              initial={{ opacity: 0, x: 0, y: 0, scale: 0.8 }}
              animate={{
                opacity: 1,
                x: node.x,
                y: node.y,
                scale: 1,
              }}
              transition={{
                duration: 1.2,
                ease: [0.16, 1, 0.3, 1],
                delay: node.delay,
              }}
              className="absolute flex items-center justify-center pointer-events-auto cursor-pointer group"
              onMouseEnter={() => onHoverNode(node.id)}
              onMouseLeave={() => onHoverNode(null)}
            >
              <motion.div
                animate={{
                  y: [0, -5, 0],
                }}
                transition={{
                  duration: 5,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: node.delay * 2,
                }}
                className="flex items-center justify-center"
              >
                {/* Point lumineux central (orbite exacte) - Opacité augmentée */}
                <div className="relative flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-white/60 group-hover:bg-white transition-colors duration-500 shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
                  <div className="absolute w-10 h-10 rounded-full bg-white/5 group-hover:bg-white/10 transition-colors duration-500 blur-md" />
                </div>
                
                {/* Label typographique rayonnant vers l'extérieur - Opacité augmentée */}
                <div className={`absolute whitespace-nowrap flex items-center justify-center ${
                  node.position === 'left' ? 'right-full mr-5' :
                  node.position === 'right' ? 'left-full ml-5' :
                  'bottom-full mb-5'
                }`}>
                  <span className="text-white/60 group-hover:text-white text-xs tracking-[0.2em] uppercase font-light transition-colors duration-500">
                    {node.label}
                  </span>
                </div>

                {/* Ligne de tension subtile (HUD effect au survol) - Opacité augmentée */}
                <div className={`absolute pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-700 ${
                  node.position === 'left' ? 'right-full w-4 h-px bg-linear-to-l from-white/40 to-transparent mr-1' :
                  node.position === 'right' ? 'left-full w-4 h-px bg-linear-to-r from-white/40 to-transparent ml-1' :
                  'bottom-full h-4 w-px bg-linear-to-t from-white/40 to-transparent mb-1'
                }`} />
              </motion.div>
            </motion.div>
          ))}
      </AnimatePresence>
    </div>
  );
}
