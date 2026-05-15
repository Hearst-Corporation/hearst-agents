"use client";

import { motion } from "framer-motion";
import { useFocalStore } from "@/stores/focal";

const SECTION_VARIANTS = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } },
};

type Props = { mode?: string };

export function AssetCompareStage({ mode = "asset-compare" }: Props) {
  const secondary = useFocalStore((s) => s.secondary);

  return (
    <motion.section
      key={mode}
      variants={SECTION_VARIANTS}
      initial="hidden"
      animate="show"
      className="preserve-3d flex w-full max-w-[760px] flex-col gap-16"
    >
      {secondary.length < 2 ? (
        <div className="flex flex-col gap-3">
          <h2 className="text-2xl font-semibold text-white/90">Comparaison d'assets</h2>
          <p className="text-sm text-white/40">Sélectionne au moins 2 assets à comparer.</p>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="flex flex-col gap-3">
            <h2 className="text-2xl font-semibold text-white/90">Comparaison d'assets</h2>
            <p className="text-sm text-white/40">
              {secondary.length} asset{secondary.length > 1 ? "s" : ""} — vue côte à côte
            </p>
          </div>

          {/* Split 50/50 */}
          <div className="flex gap-0 overflow-hidden rounded-2xl border border-white/8">
            {secondary.slice(0, 2).map((asset, idx) => (
              <div key={asset.id} className="flex flex-1 flex-col gap-4 p-5">
                {/* Titre */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/30">{idx + 1}</span>
                  <h3 className="truncate text-sm font-medium text-white/80">{asset.title}</h3>
                  {asset.type && (
                    <span className="shrink-0 rounded-full border border-white/8 bg-white/4 px-2 py-0.5 text-xs text-white/40">
                      {asset.type}
                    </span>
                  )}
                </div>

                {/* Preview placeholder */}
                <div className="relative aspect-video overflow-hidden rounded-xl bg-[rgba(255,255,255,0.04)]">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs text-white/25">{asset.title}</span>
                  </div>
                </div>

                {/* Méta */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-white/30">Statut</span>
                    <span className="text-white/55">{asset.status}</span>
                  </div>
                  {asset.wordCount !== undefined && (
                    <div className="flex justify-between text-xs">
                      <span className="text-white/30">Mots</span>
                      <span className="text-white/55">{asset.wordCount}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Séparateur vertical */}
            <div className="w-px self-stretch bg-[rgba(255,255,255,0.08)]" />
          </div>
        </>
      )}
    </motion.section>
  );
}
