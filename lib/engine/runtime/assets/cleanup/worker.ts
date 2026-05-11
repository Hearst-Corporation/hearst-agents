/**
 * Asset Cleanup Worker — Architecture Finale
 *
 * Cron-based garbage collection for expired/orphaned assets.
 * Path: lib/engine/runtime/assets/cleanup/worker.ts
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { StorageProvider } from "../storage/types";

export interface CleanupConfig {
  /** Default retention period in days */
  defaultTtlDays: number;
  /** Archive to cold storage after this many days (0 = no archive) */
  archiveAfterDays: number;
  /** Delete archived files after this many days (0 = keep forever) */
  deleteArchivedAfterDays: number;
  /** Dry run - only log, don't delete */
  dryRun: boolean;
  /** Maximum assets to process per run */
  batchSize: number;
  /** Tenant-specific overrides */
  tenantOverrides?: Record<string, { ttlDays: number; archiveAfterDays: number }>;
}

export interface CleanupResult {
  /** Assets marked for deletion */
  assetsMarked: number;
  /** Assets actually deleted */
  assetsDeleted: number;
  /** Files deleted from storage */
  filesDeleted: number;
  /** Assets archived to cold storage */
  assetsArchived: number;
  /** Errors encountered */
  errors: number;
  /** Processing duration in ms */
  durationMs: number;
  /** Details by tenant */
  byTenant: Record<string, { deleted: number; archived: number; errors: number }>;
}

/**
 * Run asset cleanup job
 */
export async function runAssetCleanup(
  db: SupabaseClient,
  storage: StorageProvider,
  config: CleanupConfig
): Promise<CleanupResult> {
  const start = Date.now();
  const result: CleanupResult = {
    assetsMarked: 0,
    assetsDeleted: 0,
    filesDeleted: 0,
    assetsArchived: 0,
    errors: 0,
    durationMs: 0,
    byTenant: {},
  };

  try {
    // 1. Find expired assets
    const expiredAssets = await findExpiredAssets(db, config);
    result.assetsMarked = expiredAssets.length;

    if (config.dryRun) {
      console.log(`[CleanupWorker] DRY RUN: Would delete ${expiredAssets.length} assets`);
      for (const asset of expiredAssets.slice(0, 10)) {
        console.log(`[CleanupWorker] Would delete: ${asset.id} (age: ${asset.ageDays} days)`);
      }
      result.durationMs = Date.now() - start;
      return result;
    }

    // 2. Process deletions
    for (const asset of expiredAssets) {
      try {
        await deleteAsset(db, storage, asset);
        result.assetsDeleted++;

        // Track by tenant
        const tenantKey = asset.tenantId || "global";
        if (!result.byTenant[tenantKey]) {
          result.byTenant[tenantKey] = { deleted: 0, archived: 0, errors: 0 };
        }
        result.byTenant[tenantKey].deleted++;
      } catch (err) {
        console.error(`[CleanupWorker] Failed to delete asset ${asset.id}:`, err);
        result.errors++;

        const tenantKey = asset.tenantId || "global";
        if (!result.byTenant[tenantKey]) {
          result.byTenant[tenantKey] = { deleted: 0, archived: 0, errors: 0 };
        }
        result.byTenant[tenantKey].errors++;
      }
    }

    // 3. Find orphaned storage files
    const orphanedFiles = await findOrphanedFiles(db, storage);
    if (!config.dryRun) {
      for (const file of orphanedFiles) {
        try {
          await storage.delete?.(file.key);
          result.filesDeleted++;
        } catch (err) {
          console.error(`[CleanupWorker] Failed to delete orphaned file ${file.key}:`, err);
          result.errors++;
        }
      }
    }

    console.log(`[CleanupWorker] Completed: ${result.assetsDeleted} assets, ${result.filesDeleted} orphaned files deleted`);
  } catch (err) {
    console.error("[CleanupWorker] Fatal error:", err);
    result.errors++;
  }

  result.durationMs = Date.now() - start;
  return result;
}

/**
 * Find assets that have exceeded their TTL.
 *
 * F-019 — check de références avant suppression :
 * Les assets référencés dans `mission_artifacts` (artifact actif d'une mission)
 * ou marqués `pinned = true` sont EXCLUS du nettoyage, quelle que soit leur
 * ancienneté. On s'appuie aussi sur `last_accessed_at` pour préserver les
 * assets récemment consultés même si créés avant la fenêtre TTL.
 *
 * Colonnes requises (migration 0078_assets_cleanup_refs.sql) :
 *   ALTER TABLE assets ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMPTZ;
 *   ALTER TABLE assets ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT FALSE;
 */
async function findExpiredAssets(
  db: SupabaseClient,
  config: CleanupConfig
): Promise<
  Array<{
    id: string;
    storageKey: string;
    tenantId?: string;
    ageDays: number;
    shouldArchive: boolean;
  }>
> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - config.defaultTtlDays);
  const cutoffIso = cutoffDate.toISOString();

  // Sous-requête : IDs des assets référencés par des mission_artifacts actifs.
  // On charge les IDs pour les exclure côté JS (Supabase JS v2 ne supporte pas
  // NOT IN avec sous-requête directe de manière type-safe).
  const { data: referencedData } = await db
    .from("mission_artifacts")
    .select("asset_id")
    .not("asset_id", "is", null);

  const referencedIds = new Set(
    (referencedData ?? [])
      .map((r: { asset_id: string | null }) => r.asset_id)
      .filter(Boolean) as string[]
  );

  const { data, error } = await db
    .from("assets")
    .select("id, content_ref, created_at, thread_id, last_accessed_at, pinned")
    .lt("created_at", cutoffIso)
    // Exclure les assets accédés récemment (last_accessed_at >= cutoff)
    .or(`last_accessed_at.is.null,last_accessed_at.lt.${cutoffIso}`)
    // Exclure les assets épinglés
    .eq("pinned", false)
    .order("created_at", { ascending: true })
    .limit(config.batchSize);

  if (error) {
    console.error("[CleanupWorker] Failed to query expired assets:", error);
    return [];
  }

  return (data || [])
    // Exclure côté JS les assets référencés par mission_artifacts
    .filter((row: { id: string }) => !referencedIds.has(row.id))
    .map((row: {
      id: string;
      content_ref: string;
      created_at: string;
      thread_id: string | null;
      last_accessed_at: string | null;
      pinned: boolean;
    }) => {
      const createdAt = new Date(row.created_at);
      const ageDays = Math.floor(
        (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Check tenant-specific archive window
      const tenantOverride = config.tenantOverrides?.[row.thread_id || "global"];
      const effectiveArchive = tenantOverride?.archiveAfterDays || config.archiveAfterDays;

      return {
        id: row.id,
        storageKey: row.content_ref,
        tenantId: row.thread_id ?? undefined,
        ageDays,
        shouldArchive: effectiveArchive > 0 && ageDays >= effectiveArchive,
      };
    });
}

/**
 * Delete an asset and its storage
 */
async function deleteAsset(
  db: SupabaseClient,
  storage: StorageProvider,
  asset: {
    id: string;
    storageKey: string;
    shouldArchive: boolean;
  }
): Promise<void> {
  // Delete from storage first (idempotent)
  if (asset.storageKey) {
    try {
      await storage.delete?.(asset.storageKey);
    } catch (err) {
      // Log but continue - file might already be gone
      console.warn(`[CleanupWorker] Storage delete warning for ${asset.id}:`, err);
    }
  }

  // Delete from database
  const { error } = await db.from("assets").delete().eq("id", asset.id);

  if (error) {
    throw new Error(`Database delete failed: ${error.message}`);
  }
}

/**
 * Find orphaned files in storage (not referenced in DB)
 */
async function findOrphanedFiles(
  _db: SupabaseClient,
  _storage: StorageProvider
): Promise<Array<{ key: string; size: number; lastModified: Date }>> {
  // This is provider-specific and may require listing all storage files
  // For now, return empty - implement per-provider
  console.log("[CleanupWorker] Orphaned file detection not implemented for this storage provider");
  return [];
}
