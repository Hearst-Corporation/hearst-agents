/**
 * Video Quick Launch Store — Zustand
 *
 * Pilote l'ouverture du panel `VideoQuickLaunch` (⌘G — S2-A). Volatil,
 * pas de persist : chaque ouverture repart d'un formulaire vierge.
 *
 * Le panel est monté en permanence dans `(user)/layout.tsx` ; cette boutique
 * sert uniquement de toggle. Les preferences (provider/duration/ratio) vivent
 * dans le state local du composant pour ne pas polluer le store global.
 */

import { create } from "zustand";

export interface VideoQuickLaunchState {
  open: boolean;
  /** Ouvre le panel — déclenché par ⌘G ou Commandeur. */
  openLauncher: () => void;
  /** Ferme le panel — bouton fermer ou ESC. */
  close: () => void;
  /** Toggle ouverture/fermeture — utilisé par le hotkey ⌘G. */
  toggle: () => void;
}

export const useVideoQuickLaunchStore = create<VideoQuickLaunchState>((set, get) => ({
  open: false,
  openLauncher: () => set({ open: true }),
  close: () => set({ open: false }),
  toggle: () => set({ open: !get().open }),
}));
