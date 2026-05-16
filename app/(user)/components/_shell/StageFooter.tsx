"use client";

/**
 * StageFooter — pill flottante glass affichant le contexte du stage actif :
 * status • 2 actions • toggle binaire de mode.
 *
 * Composition portée depuis `lab/cli-os/src/components/Footer.tsx` mais adaptée
 * à la voix éditoriale Hearst (FR régulier, palette teal, classes DS).
 *
 * Le composant est **autonome** : pas de translateX(-50%) en interne, c'est
 * au parent (ChatDock) de le centrer via flex.
 *
 * Retourne `null` si le stage actif n'a pas d'entrée dans STAGE_FOOTER_DATA
 * (avec console.warn en dev pour signaler l'oubli).
 */

import { useStageStore } from "@/stores/stage";
import type { StageKey } from "../../_stages/types";

type FooterContent = {
  status: string;
  actions: readonly [string, string];
  modes: readonly [string, string];
};

const STAGE_FOOTER_DATA: Record<StageKey, FooterContent> = {
  cockpit: {
    status: "Nominal",
    actions: ["Briefing", "Missions"],
    modes: ["Tout", "Runs"],
  },
  chat: {
    status: "Connecté",
    actions: ["Envoyer", "Contexte"],
    modes: ["Auto", "Manuel"],
  },
  mission: {
    status: "En cours",
    actions: ["Approuver", "Pause"],
    modes: ["Auto", "Pas-à-pas"],
  },
  asset: {
    status: "Chargé",
    actions: ["Ouvrir", "Comparer"],
    modes: ["Vue", "Édition"],
  },
  asset_compare: {
    status: "Comparaison",
    actions: ["Synchroniser", "Diff"],
    modes: ["Côte à côte", "Superposé"],
  },
  browser: {
    status: "Live",
    actions: ["Piloter", "Capturer"],
    modes: ["Auto", "Manuel"],
  },
  voice: {
    status: "Écoute active",
    actions: ["Muet", "Transférer"],
    modes: ["Continu", "Push-to-talk"],
  },
  meeting: {
    status: "En réunion",
    actions: ["Notes", "Actions"],
    modes: ["Live", "Récap"],
  },
  artifact: {
    status: "Runtime prêt",
    actions: ["Exécuter", "Exporter"],
    modes: ["Python", "Node"],
  },
  kg: {
    status: "Indexé",
    actions: ["Explorer", "Ajouter"],
    modes: ["Graphe", "Liste"],
  },
  simulation: {
    status: "Scénario prêt",
    actions: ["Lancer", "Réinitialiser"],
    modes: ["Auto", "Manuel"],
  },
  signal: {
    status: "Surveillance",
    actions: ["Voir", "Acquitter"],
    modes: ["Temps réel", "Historique"],
  },
};

export function StageFooter() {
  const mode = useStageStore((s) => s.current.mode);
  const data = STAGE_FOOTER_DATA[mode];
  if (!data) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[StageFooter] No footer data for mode "${mode}". Add it to STAGE_FOOTER_DATA.`);
    }
    return null;
  }

  return (
    <div
      className="vision-glass preserve-3d flex items-center gap-12 whitespace-nowrap"
      style={{
        padding: "var(--space-3-5) var(--space-6)",
        borderRadius: "var(--radius-pill)",
        transform: "translateZ(20px)",
      }}
      aria-label="Actions du stage actif"
    >
      <div className="flex items-center" style={{ gap: "var(--space-2-5)" }}>
        <span
          aria-hidden="true"
          className="block shrink-0"
          style={{
            width: "var(--space-1-5)",
            height: "var(--space-1-5)",
            borderRadius: "var(--radius-pill)",
            background: "var(--accent-teal)",
            boxShadow: "var(--shadow-pulse-dot)",
          }}
        />
        <span
          className="t-11 font-medium text-(--text-faint)"
          aria-live="polite"
          aria-atomic="true"
        >
          {data.status}
        </span>
      </div>

      <div className="flex items-center" style={{ gap: "var(--space-2)" }}>
        <button
          type="button"
          className="vision-btn-primary t-12"
          style={{
            padding: "var(--space-1-5) var(--space-4)",
            borderRadius: "var(--radius-pill)",
            border: "none",
            fontWeight: 500,
          }}
        >
          {data.actions[0]}
        </button>
        <button
          type="button"
          className="vision-btn-glass t-12"
          style={{
            padding: "var(--space-1-5) var(--space-4)",
            borderRadius: "var(--radius-pill)",
            fontWeight: 500,
          }}
        >
          {data.actions[1]}
        </button>
      </div>

      <div
        className="vision-segmented-track flex items-center"
        style={{ padding: "var(--space-0-5)", borderRadius: "var(--radius-pill)" }}
        role="tablist"
        aria-label="Mode du stage"
      >
        {data.modes.map((label, i) => {
          const isActive = i === 0;
          return (
            <button
              key={label}
              type="button"
              role="tab"
              aria-selected={isActive}
              className="t-11"
              style={{
                padding: "var(--space-1) var(--space-3-5)",
                borderRadius: "var(--radius-pill)",
                fontWeight: 500,
                background: isActive ? "var(--border-default)" : "transparent",
                color: isActive ? "var(--text-l1)" : "var(--text-l2)",
                border: "none",
                transition: "all var(--duration-base) var(--ease-standard)",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
