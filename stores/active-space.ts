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
 * Sync cookie (Phase 2) :
 *   En complément du `localStorage` géré par `persist`, le store réplique
 *   l'`activeSpaceId` dans un cookie `hearst-active-space-id` (path `/`,
 *   max-age 1 an). Ce cookie est lu côté serveur par
 *   `lib/multi-tenant/active-space.ts#getActiveSpaceIdFromRequest()` pour
 *   que les RSC / route handlers puissent connaître le space actif sans
 *   passer par un payload explicite. Pas d'info sensible → cookie non signé.
 *
 * Voir `lib/multi-tenant/types.ts` pour le type `SpaceId` partagé.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Nom du cookie partagé client/serveur. Doit rester synchronisé avec
 * `lib/multi-tenant/active-space.ts#ACTIVE_SPACE_COOKIE`.
 */
const ACTIVE_SPACE_COOKIE = "hearst-active-space-id";

/** 1 an en secondes — assez pour survivre à la majorité des reloads. */
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/**
 * Écrit l'`activeSpaceId` dans le cookie partagé. No-op côté serveur
 * (SSR initial pre-hydration) — on attend que React monte côté client
 * avant de toucher `document.cookie`.
 */
function writeActiveSpaceCookie(spaceId: string) {
  if (typeof document === "undefined") return;
  const value = encodeURIComponent(spaceId);
  // SameSite=Lax : on a besoin que le cookie remonte sur les nav top-level
  // (RSC, route handlers internes). Pas de Secure en local dev (http) ; en
  // prod le cookie sera de toute façon servi sur https donc Secure implicite
  // côté navigateur via Strict-Transport-Security.
  document.cookie = `${ACTIVE_SPACE_COOKIE}=${value}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
}

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
      // Réhydratation depuis localStorage : on en profite pour resync le
      // cookie au cas où il ait été cleaned (DevTools, autre device, etc.).
      onRehydrateStorage: () => (state) => {
        if (state?.activeSpaceId) {
          writeActiveSpaceCookie(state.activeSpaceId);
        }
      },
    },
  ),
);

// Subscription au store : à chaque changement d'`activeSpaceId`, on
// réécrit le cookie partagé pour que `getActiveSpaceIdFromRequest()`
// (server-side) reste aligné avec l'état client. Souscription unique au
// niveau module — pas besoin de cleanup, le store est singleton.
useActiveSpace.subscribe((state, prevState) => {
  if (state.activeSpaceId !== prevState.activeSpaceId) {
    writeActiveSpaceCookie(state.activeSpaceId);
  }
});

// Initialisation au boot client : `subscribe` ne fire qu'au prochain
// changement, donc on amorce explicitement le cookie avec la valeur
// initiale (utile au tout premier render avant le moindre clic).
if (typeof document !== "undefined") {
  writeActiveSpaceCookie(useActiveSpace.getState().activeSpaceId);
}
