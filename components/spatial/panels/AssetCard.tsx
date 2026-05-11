"use client";

import { FloatingPanel } from "./FloatingPanel";

interface AssetCardProps {
  show: boolean;
  onClose: () => void;
}

/**
 * Asset généré — card centrée, contenu minimal.
 * Apparaît en stage=asset après une mission.
 */
export function AssetCard({ show, onClose }: AssetCardProps) {
  return (
    <FloatingPanel show={show} anchor="center" delay={0.1} width={460}>
      <div className="px-9 py-9 relative">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="absolute top-5 right-5 text-white/35 hover:text-white/85 transition-colors duration-300"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className="text-white/45 text-spatial-sm tracking-[0.34em] uppercase font-light mb-4">
          Asset généré
        </div>
        <h3 className="text-white/95 text-spatial-3xl font-light tracking-wide leading-snug">
          Analyse stratégique — Q2
        </h3>
        <div className="mt-5 h-px w-10 bg-white/15" />
        <p className="mt-5 text-white/70 text-spatial-lg font-light leading-[1.7]">
          Synthèse des trois sujets prioritaires consolidée. Décision en attente
          sur le segment B2B.
        </p>

        <div className="mt-8 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-full text-spatial-md tracking-[0.18em] uppercase font-light text-white/60 hover:text-white/90 transition-colors duration-300"
          >
            Fermer
          </button>
          <button
            type="button"
            className="px-6 py-2 rounded-full text-spatial-md tracking-[0.18em] uppercase font-light"
            style={{
              backgroundColor: "rgba(255,255,255,0.92)",
              color: "#0a0a0c",
              boxShadow: "0 6px 18px -6px rgba(255,255,255,0.35)",
            }}
          >
            Ouvrir
          </button>
        </div>
      </div>
    </FloatingPanel>
  );
}
