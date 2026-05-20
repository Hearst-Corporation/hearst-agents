"use client";

import { motion } from "framer-motion";
import { VISION_EASE } from "@/app/(user)/_stages/types";

type StageErrorBannerProps = {
  message: string;
  /** Libellé avant le tiret — défaut « Erreur ». */
  title?: string;
  /**
   * default — fond /5, leading-relaxed (Asset, Meeting, Chat).
   * emphasis — fond /8, opacités bordure/texte renforcées (Mission, KG, Browser).
   */
  variant?: "default" | "emphasis";
};

/**
 * Bannière d'erreur unifiée pour les Stages cockpit.
 * Remplace les 7 implémentations locales (motion + tokens danger).
 */
export function StageErrorBanner({
  message,
  title = "Erreur",
  variant = "default",
}: StageErrorBannerProps) {
  const className =
    variant === "emphasis"
      ? "px-4.5 py-3.5 rounded-xl bg-(--danger)/8 border-l-2 border-(--danger)/55 text-(--danger)/85 t-13 leading-[1.55]"
      : "rounded-xl border-l-2 border-(--danger) bg-(--danger)/5 px-4.5 py-3.5 t-13 font-light text-(--danger) leading-relaxed";

  const strongClass = variant === "emphasis" ? "text-(--danger)/95 font-semibold" : "font-semibold";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: VISION_EASE }}
      className={className}
    >
      <strong className={strongClass}>{title}</strong> — {message}
    </motion.div>
  );
}
