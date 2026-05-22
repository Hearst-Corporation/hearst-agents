"use client";

import type { ReactNode } from "react";
import { Shell } from "@/app/(user)/_shell/Shell";

/**
 * Wrapper canonique pour les routes "standalone" (hors Stage cockpit).
 * Rend le Shell 3-colonnes (LeftRail + centre + RightRailChat) avec
 * `children` injecté comme `centerContent`.
 *
 * Toutes les pages qui utilisent ce composant héritent automatiquement
 * du rail gauche et du chat droite sans aucune modification individuelle.
 *
 * Routes concernées : /reports, /reports/studio, /settings, /settings/alerting,
 * /marketplace, /notifications, /archive, /hospitality.
 *
 * ⚠️  DOUBLE-SCROLL À SURVEILLER :
 * Le <main> du Shell a `overflow-y-auto pt-6 pb-48`. Si la page enfant
 * utilise <ScreenShell> (qui a son propre `overflow-y-auto` interne),
 * deux contextes de scroll coexistent. En pratique <ScreenShell> est
 * `flex-1 flex flex-col min-h-0 overflow-hidden` sur son enveloppe
 * extérieure — le main Shell scrollera et <ScreenShell> se comportera
 * en colonne flex sans débordement propre. Risque : hauteur cassée si
 * une page interne repose sur `h-full` strict. Valider visuellement
 * avant merge. Ne pas modifier Shell.tsx ni ScreenShell pour corriger.
 */
export function StandalonePageFrame({ children }: { children: ReactNode }) {
  return <Shell centerContent={children} scrollable={false} />;
}
