/**
 * Active space — helper server-side (Phase 2 / Q3-C).
 *
 * Lit le `spaceId` actif depuis le cookie `hearst-active-space-id`,
 * synchronisé côté client par `stores/active-space.ts` (subscription
 * Zustand qui réécrit le cookie à chaque switch de space).
 *
 * Pourquoi un cookie en plus du localStorage Zustand ?
 *   - Zustand persist écrit dans `localStorage` (clé `hearst-active-space`),
 *     invisible côté serveur (RSC, route handlers, server actions).
 *   - On duplique l'`activeSpaceId` dans un cookie httponly=false côté
 *     client → le serveur peut le lire via `next/headers#cookies()`.
 *   - Pas d'info sensible : juste un slug ('personal' / 'side-project' /
 *     'venture'). Pas besoin de signer le cookie.
 *
 * IMPORTANT — Phase 2 / Foundation :
 *   Ce helper EXISTE mais n'est appelé par aucune query existante. Il
 *   sera consommé par les routes/loaders en Phase 3 quand on branchera
 *   le filtre `WHERE space_id = ?`. Aujourd'hui il sert juste à valider
 *   que la chaîne client → cookie → server fonctionne.
 *
 * Voir `docs/features/spaces.md` pour la roadmap complète.
 */

import { cookies } from "next/headers";

/**
 * Nom du cookie partagé client/serveur. Aligné sur la subscription
 * dans `stores/active-space.ts` — toute modification ici doit être
 * répercutée là-bas.
 */
export const ACTIVE_SPACE_COOKIE = "hearst-active-space-id";

/**
 * Default appliqué quand le cookie est absent (premier rendu, user
 * jamais passé côté cockpit, etc.). Aligné sur `DEFAULT_SPACES[0].id`
 * dans `stores/active-space.ts`.
 */
export const DEFAULT_SPACE_ID = "personal";

/**
 * Lit l'`activeSpaceId` depuis les cookies de la requête courante.
 *
 * À appeler depuis :
 *   - Server Components (RSC)
 *   - Route Handlers (`app/api/**\/route.ts`)
 *   - Server Actions
 *
 * Ne pas appeler depuis du code client — utiliser `useActiveSpace()`
 * dans ce cas.
 *
 * @returns Le slug du space actif ou `DEFAULT_SPACE_ID` si pas de cookie.
 */
export async function getActiveSpaceIdFromRequest(): Promise<string> {
  // Next 15+ : cookies() est async et retourne une Promise<ReadonlyRequestCookies>.
  const cookieStore = await cookies();
  const raw = cookieStore.get(ACTIVE_SPACE_COOKIE)?.value;

  // Garde-fou : un cookie vide ou contenant uniquement des espaces blancs
  // tombe sur le default plutôt que de renvoyer une string vide en aval.
  if (!raw || raw.trim().length === 0) {
    return DEFAULT_SPACE_ID;
  }

  return raw;
}
