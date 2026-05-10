/**
 * Active Space Store — Zustand (foundation Q3-C)
 *
 * "Espaces" = silo logique multi-projets (perso / side-project / venture). Le
 * store conserve la liste des spaces déclarés et l'id actif. Persistance via
 * `persist` (clé `hearst-active-space`) pour que la sélection survive aux
 * reloads et aux relances Electron.
 *
 * IMPORTANT — Phase 1 / Foundation only :
 *   - Ce store expose `activeSpaceId` mais AUCUNE query n'y est encore branchée.
 *   - Tant que la Phase 3 n'est pas livrée (cf. `docs/features/spaces.md`), le
 *     selector est cosmétique : asset/mission/run/report restent globalement
 *     scopés au workspace courant (cf. `lib/multi-tenant/`).
 *   - Ne PAS dériver de logique métier de `activeSpaceId` tant que la migration
 *     DB (Phase 2) n'a pas posé la colonne `space_id` côté Supabase.
 *
 * Voir `lib/multi-tenant/types.ts` pour le type `SpaceId` partagé.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface SpaceConfig {
  /** Slug stable, sert de FK future côté DB (Phase 2). Ex: `personal`. */
  id: string;
  /** Label court affiché en tooltip et badges. Ex: `Perso`. */
  label: string;
  /** CSS var (jamais une valeur hex en dur) — utilisée pour le dot du selector. */
  color: string;
}

export const DEFAULT_SPACES: SpaceConfig[] = [
  { id: "personal", label: "Perso", color: "var(--accent-teal)" },
  { id: "side-project", label: "Side", color: "var(--gold)" },
  { id: "venture", label: "Venture", color: "var(--accent-llm)" },
];

interface ActiveSpaceState {
  activeSpaceId: string;
  spaces: SpaceConfig[];
  setActiveSpace: (id: string) => void;
  addSpace: (space: SpaceConfig) => void;
  removeSpace: (id: string) => void;
}

export const useActiveSpace = create<ActiveSpaceState>()(
  persist(
    (set, get) => ({
      activeSpaceId: "personal",
      spaces: DEFAULT_SPACES,

      setActiveSpace: (id) => {
        // Garde-fou : on n'active jamais un id absent de la liste — sinon le
        // selector pointerait dans le vide et masquerait un bug downstream.
        const exists = get().spaces.some((s) => s.id === id);
        if (!exists) return;
        set({ activeSpaceId: id });
      },

      addSpace: (space) =>
        set((state) => {
          // Idempotent : si l'id existe déjà, on remplace plutôt que de
          // dupliquer (utile quand un import vient ré-écrire un space connu).
          const filtered = state.spaces.filter((s) => s.id !== space.id);
          return { spaces: [...filtered, space] };
        }),

      removeSpace: (id) =>
        set((state) => {
          // On refuse de supprimer le dernier space — l'app a besoin d'au
          // moins un silo actif pour rester cohérente (sinon `activeSpaceId`
          // pointerait dans le vide).
          if (state.spaces.length <= 1) return state;
          const newSpaces = state.spaces.filter((s) => s.id !== id);
          // Si on supprime le space actif, on bascule sur le premier restant.
          const newActiveId =
            state.activeSpaceId === id ? newSpaces[0].id : state.activeSpaceId;
          return { spaces: newSpaces, activeSpaceId: newActiveId };
        }),
    }),
    {
      name: "hearst-active-space",
      version: 1,
      partialize: (state) => ({
        activeSpaceId: state.activeSpaceId,
        spaces: state.spaces,
      }),
    },
  ),
);
