/**
 * Multi-tenant scope types.
 *
 * Every runtime entity (run, mission, asset, connector call) MUST carry
 * a TenantScope. Unscoped entities are forbidden in v2.
 */

/**
 * SpaceId — silo logique multi-projets à l'intérieur d'un même workspace.
 *
 * Phase 2 (Q3-C) : type exposé et propagé par défaut sur `TenantScope` /
 * `ScopedMetadata`. La migration DB (`supabase/migrations/0062_*`) a posé
 * la colonne `space_id text NOT NULL DEFAULT 'personal'` sur les tables
 * tenant-scoped concernées. Aucune query n'est encore *filtrée* par ce
 * champ — Phase 3 brancher le filtre `WHERE space_id = ?` route par route.
 * Voir `docs/features/spaces.md` pour la roadmap.
 */
export type SpaceId = string;

/**
 * Default appliqué partout où `spaceId` n'est pas explicitement fourni.
 * Aligné sur :
 *   - `DEFAULT_SPACES[0].id` dans `stores/active-space.ts`
 *   - `DEFAULT_SPACE_ID` dans `lib/multi-tenant/active-space.ts`
 *   - `DEFAULT 'personal'` dans `supabase/migrations/0062_*`
 */
export const DEFAULT_SPACE_ID: SpaceId = "personal";

export interface TenantScope {
  tenantId: string;
  workspaceId: string;
  userId?: string;
  /**
   * Phase 2 : champ optionnel côté type (rétro-compat avec tous les
   * call-sites Phase 1) mais consommé avec default `DEFAULT_SPACE_ID`
   * partout où il est lu. Utiliser `resolveSpaceId(scope)` pour obtenir
   * la valeur effective. Phase 3 rendra le filtrage `WHERE space_id = ?`
   * effectif côté queries.
   */
  spaceId?: SpaceId;
}

export interface ScopedMetadata {
  tenantId: string;
  workspaceId: string;
  userId?: string;
  /** Voir `TenantScope.spaceId` — même contrat. */
  spaceId?: SpaceId;
}

/**
 * Résolveur d'ergonomie : extrait `spaceId` d'un scope ou retombe sur
 * `DEFAULT_SPACE_ID`. À utiliser systématiquement côté query Phase 3
 * pour éviter de tester `scope.spaceId ?? "personal"` partout.
 */
export function resolveSpaceId(scope: Pick<TenantScope, "spaceId"> | null | undefined): SpaceId {
  return scope?.spaceId ?? DEFAULT_SPACE_ID;
}
