/**
 * Multi-tenant scope types.
 *
 * Every runtime entity (run, mission, asset, connector call) MUST carry
 * a TenantScope. Unscoped entities are forbidden in v2.
 */

export interface TenantScope {
  tenantId: string;
  workspaceId: string;
  userId?: string;
}

export interface ScopedMetadata {
  tenantId: string;
  workspaceId: string;
  userId?: string;
}

