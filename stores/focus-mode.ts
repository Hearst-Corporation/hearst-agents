/**
 * Focus Mode Store — Zustand
 *
 * S4-B : Mode Focus (⌘⇧F).
 *
 * Quand `enabled` est true :
 *   - PulseBar rétracté (translateY(-100%))
 *   - TimelineRail (gauche) masqué (width 0)
 *   - ContextRail (droite) masqué (width 0)
 *   - Stage central prend 100vw — uniquement le ChatDock en bas reste
 *   - StageFooter conservé (continuité du flowLabel)
 *
 * UX : Idéal pour se concentrer sur une mission/asset/rapport sans
 * distraction. Une mini-badge flottante "Mode focus actif · Échap"
 * permet de sortir au clic ou via la touche ESC.
 *
 * Mission context (TODO bonus) : si une mission est active dans
 * useStageStore (mode === "mission") + focus enabled, le system prompt
 * envoyé à /api/orchestrate doit être enrichi avec une ligne
 * "Focus mode actif sur mission : [titre]. Toutes les réponses doivent
 * être orientées vers cet objectif." — câblage côté pipeline LLM à
 * faire dans un second temps si pertinent.
 *
 * Persistance : `hearst-focus-mode` (localStorage). On garde le mode
 * actif entre sessions car c'est un choix d'environnement de travail
 * cohérent (le user qui était en focus mode hier veut probablement y
 * être encore aujourd'hui).
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface FocusModeState {
  enabled: boolean;
  toggle: () => void;
  enable: () => void;
  disable: () => void;
}

export const useFocusMode = create<FocusModeState>()(
  persist(
    (set) => ({
      enabled: false,
      toggle: () => set((state) => ({ enabled: !state.enabled })),
      enable: () => set({ enabled: true }),
      disable: () => set({ enabled: false }),
    }),
    {
      name: "hearst-focus-mode",
      version: 1,
      partialize: (state) => ({ enabled: state.enabled }),
    },
  ),
);
