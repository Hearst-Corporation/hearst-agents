"use client";

/**
 * StageFooter — pill flottante glass affichant le **contexte** du stage actif.
 *
 * Composition portée depuis `lab/cli-os/src/components/Footer.tsx` mais adaptée
 * à la voix éditoriale Hearst (FR régulier, palette teal, classes DS).
 *
 * Les éléments rendus sont **purement informatifs** : statut courant + chips
 * de contexte non cliquables. Les actions réelles sont déclenchées par le
 * Commandeur (Cmd+K) ou les hotkeys spécifiques au stage — on évite ainsi
 * d'exposer des contrôles qui ressemblent à des actions actives mais ne sont
 * pas câblés. Le layout est conservé pour préserver la composition avec
 * ChatDock.
 *
 * Retourne `null` si le stage actif n'a pas d'entrée dans STAGE_FOOTER_DATA
 * (avec console.warn en dev pour signaler l'oubli).
 */

import { useStageStore } from "@/stores/stage";
import type { StageKey } from "../../_stages/types";

type FooterContent = {
  status: string;
  /** Chips de contexte (non cliquables) — décrivent l'état, pas des actions. */
  contextChips: readonly string[];
};

const STAGE_FOOTER_DATA: Record<StageKey, FooterContent> = {
  cockpit: { status: "Nominal", contextChips: ["Cockpit"] },
  chat: { status: "Connecté", contextChips: ["Conversation"] },
  mission: { status: "En cours", contextChips: ["Mission"] },
  asset: { status: "Chargé", contextChips: ["Asset"] },
  asset_compare: { status: "Comparaison", contextChips: ["Comparaison"] },
  browser: { status: "Live", contextChips: ["Browser"] },
  voice: { status: "Écoute active", contextChips: ["Voice"] },
  meeting: { status: "En réunion", contextChips: ["Meeting"] },
  artifact: { status: "Runtime prêt", contextChips: ["Artifact"] },
  kg: { status: "Indexé", contextChips: ["Knowledge"] },
  simulation: { status: "Scénario prêt", contextChips: ["Simulation"] },
  signal: { status: "Surveillance", contextChips: ["Signal"] },
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
      role="status"
      aria-label="Contexte du stage actif"
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
        {data.contextChips.map((chip) => (
          <span
            key={chip}
            className="t-11 font-medium"
            style={{
              padding: "var(--space-1) var(--space-3-5)",
              borderRadius: "var(--radius-pill)",
              background: "color-mix(in srgb, var(--accent-teal) 10%, transparent)",
              border: "1px solid color-mix(in srgb, var(--accent-teal) 25%, transparent)",
              color: "var(--text-l1)",
            }}
          >
            {chip}
          </span>
        ))}
      </div>
    </div>
  );
}
