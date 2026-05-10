/**
 * Multi-tenant scope types.
 *
 * Every runtime entity (run, mission, asset, connector call) MUST carry
 * a TenantScope. Unscoped entities are forbidden in v2.
 */

/**
 * SpaceId — silo logique multi-projets à l'intérieur d'un même workspace.
 *
 * Foundation only (Q3-C, Phase 1) : le type est exposé pour que les futurs
 * consumers (asset, mission, run, report, brief, watchlist) puissent déjà
 * carrier l'optionnel `spaceId?` sans casser le compile. Aucune query n'est
 * encore filtrée par ce champ — voir `docs/features/spaces.md` pour la
 * roadmap de migration en 3 phases.
 */
export type SpaceId = string;

export interface TenantScope {
  tenantId: string;
  workspaceId: string;
  userId?: string;
  /**
   * Phase 1 : optionnel et non lu côté query. Sert juste à propager l'id
   * depuis les call-sites qui veulent déjà préparer la migration. Phase 3
   * rendra le filtrage effectif (cf. `docs/features/spaces.md`).
   */
  spaceId?: SpaceId;
}

export interface ScopedMetadata {
  tenantId: string;
  workspaceId: string;
  userId?: string;
  /** Voir `TenantScope.spaceId` — même contrat, foundation only. */
  spaceId?: SpaceId;
}

