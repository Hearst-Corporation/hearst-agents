"use client";

import { motion } from "framer-motion";
import { useFocalStore } from "@/stores/focal";

const SECTION_VARIANTS = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } },
};

type Props = { mode?: string };

export function AssetStage({ mode = "asset" }: Props) {
  const focal = useFocalStore((s) => s.focal);

  return (
    <motion.section
      key={mode}
      variants={SECTION_VARIANTS}
      initial="hidden"
      animate="show"
      className="preserve-3d flex w-full max-w-[760px] flex-col gap-16"
    >
      {focal === null ? (
        <div className="flex flex-col gap-3">
          <h2 className="text-2xl font-semibold text-white/90">Aucun asset sélectionné</h2>
          <p className="text-sm text-white/40">Ouvre un asset depuis le chat ou la bibliothèque.</p>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-semibold text-white/90">{focal.title}</h2>
              {focal.type && (
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs text-white/50">
                  {focal.type}
                </span>
              )}
            </div>
            {focal.summary && (
              <p className="text-sm leading-relaxed text-white/50">{focal.summary}</p>
            )}
          </div>

          {/* Grille 2×2 variants placeholder */}
          <div className="relative">
            <div className="grid grid-cols-2 gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="aspect-square animate-pulse rounded-xl bg-[rgba(255,255,255,0.04)]"
                />
              ))}
            </div>

            {/* Overlay card */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="rounded-2xl border border-white/10 bg-[rgba(8,8,8,0.75)] px-6 py-4 text-center backdrop-blur-md">
                <p className="text-sm font-medium text-white/70">Rendu asset — câblé en P6</p>
                <p className="mt-1 text-xs text-white/35">4 variants en attente</p>
              </div>
            </div>
          </div>

          {/* Métadonnées */}
          <div className="flex flex-col gap-2 rounded-xl border border-white/6 bg-[rgba(255,255,255,0.03)] px-5 py-4">
            {focal.provider && (
              <div className="flex justify-between text-xs">
                <span className="text-white/35">Fournisseur</span>
                <span className="text-white/60">{focal.provider}</span>
              </div>
            )}
            {focal.wordCount !== undefined && (
              <div className="flex justify-between text-xs">
                <span className="text-white/35">Mots</span>
                <span className="text-white/60">{focal.wordCount}</span>
              </div>
            )}
            <div className="flex justify-between text-xs">
              <span className="text-white/35">Statut</span>
              <span className="text-white/60">{focal.status}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-white/35">Mis à jour</span>
              <span className="text-white/60">
                {new Date(focal.updatedAt).toLocaleString("fr-FR")}
              </span>
            </div>
          </div>
        </>
      )}
    </motion.section>
  );
}
