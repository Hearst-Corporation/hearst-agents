"use client";

import { motion, AnimatePresence } from "framer-motion";

interface ConstellationNavProps {
  stage: "idle" | "focus" | "mission" | "asset";
  onHoverNode: (nodeId: string | null) => void;
}

export function ConstellationNav({ stage, onHoverNode }: ConstellationNavProps) {
  // Orbites légèrement plus éloignées pour plus d'espace, de "respiration"
  const radiusX = 360;
  const radiusY = 260;

  const navNodes = [
    { id: "apps", label: "Connecteurs", position: "left", x: -radiusX, y: 0, delay: 0.2 },
    { id: "history", label: "Investigations", position: "right", x: radiusX, y: 0, delay: 0.4 },
    { id: "profile", label: "Espace Personnel", position: "top", x: 0, y: -radiusY, delay: 0.6 },
  ];

  return (
    <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
      <AnimatePresence>
        {stage === "focus" &&
          navNodes.map((node) => (
            <motion.div
              key={node.id}
              initial={{ opacity: 0, filter: "blur(10px)" }}
              animate={{
                opacity: 1,
                x: node.x,
                y: node.y,
                filter: "blur(0px)"
              }}
              exit={{ opacity: 0, filter: "blur(10px)", transition: { duration: 0.8 } }}
              transition={{
                duration: 2, // Lenteur premium
                ease: [0.16, 1, 0.3, 1],
                delay: node.delay,
              }}
              className="absolute flex items-center justify-center pointer-events-auto cursor-pointer group"
              onMouseEnter={() => onHoverNode(node.id)}
              onMouseLeave={() => onHoverNode(null)}
            >
              <motion.div
                animate={{
                  y: [0, -4, 0],
                }}
                transition={{
                  duration: 6, // Flottement ultra lent
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: node.delay * 2,
                }}
                className="flex items-center justify-center"
              >
                {/* Point lumineux minimaliste */}
                <div className="relative flex items-center justify-center">
                  <div className="w-1 h-1 rounded-full bg-white/40 group-hover:bg-white transition-colors duration-700 shadow-[0_0_8px_rgba(255,255,255,0.4)] group-hover:shadow-[0_0_16px_rgba(255,255,255,0.8)] group-hover:scale-150 transform" />
                  <div className="absolute w-8 h-8 rounded-full bg-white/[0.02] group-hover:bg-white/[0.05] transition-colors duration-700 blur-md" />
                </div>
                
                {/* Label typographique élégant */}
                <div className={`absolute whitespace-nowrap flex items-center justify-center ${
                  node.position === 'left' ? 'right-full mr-6' :
                  node.position === 'right' ? 'left-full ml-6' :
                  'bottom-full mb-6'
                }`}>
                  <span className="text-white/30 group-hover:text-white/90 text-[10px] tracking-[0.3em] uppercase font-light transition-colors duration-700">
                    {node.label}
                  </span>
                </div>

                {/* HUD effect extremely subtle */}
                <div className={`absolute pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-1000 ${
                  node.position === 'left' ? 'right-full w-8 h-px bg-linear-to-l from-white/20 to-transparent mr-2' :
                  node.position === 'right' ? 'left-full w-8 h-px bg-linear-to-r from-white/20 to-transparent ml-2' :
                  'bottom-full h-8 w-px bg-linear-to-t from-white/20 to-transparent mb-2'
                }`} />
              </motion.div>
            </motion.div>
          ))}
      </AnimatePresence>
    </div>
  );
}
