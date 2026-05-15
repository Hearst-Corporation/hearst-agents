/**
 * Asset Cleanup Worker — Architecture Finale
 *
 * Cron-based garbage collection for expired/orphaned assets.
 * Path: lib/engine/runtime/assets/cleanup/worker.ts
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { StorageProvider } from "../storage/types";
import { logger } from "@/lib/observability/logger";

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

    // 2. Find orphaned storage files (always — detection runs in dry-run too, only deletion is gated)
    const orphanedFiles = await findOrphanedFiles(db, storage);

    if (config.dryRun) {
      logger.info(
        { expired_count: expiredAssets.length, orphan_count: orphanedFiles.length },
        "[cleanup] dry-run: would delete assets and orphaned files"
      );
      result.durationMs = Date.now() - start;
      return result;
    }

    // 3. Process expired asset deletions
    for (const asset of expiredAssets) {
      try {
        await deleteAsset(db, storage, asset);
        result.assetsDeleted++;

        const tenantKey = asset.tenantId || "global";
        if (!result.byTenant[tenantKey]) {
          result.byTenant[tenantKey] = { deleted: 0, archived: 0, errors: 0 };
        }
        result.byTenant[tenantKey].deleted++;
      } catch (err) {
        logger.error({ err, assetId: asset.id }, "[cleanup] failed to delete asset");
        result.errors++;

        const tenantKey = asset.tenantId || "global";
        if (!result.byTenant[tenantKey]) {
          result.byTenant[tenantKey] = { deleted: 0, archived: 0, errors: 0 };
        }
        result.byTenant[tenantKey].errors++;
      }
    }

    // 4. Delete orphaned storage files
    for (const file of orphanedFiles) {
      try {
        await storage.delete(file.key);
        result.filesDeleted++;
      } catch (err) {
        logger.error({ err, key: file.key }, "[cleanup] failed to delete orphaned file");
        result.errors++;
      }
    }

    logger.info(
      { assets_deleted: result.assetsDeleted, files_deleted: result.filesDeleted, errors: result.errors },
      "[cleanup] run completed"
    );
  } catch (err) {
    logger.error({ err }, "[cleanup] fatal error");
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
    logger.error({ err: error }, "[cleanup] failed to query expired assets");
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
      await storage.delete(asset.storageKey);
    } catch (err) {
      logger.warn({ err, assetId: asset.id }, "[cleanup] storage delete warning, file may already be gone");
    }
  }

  // Delete from database
  const { error } = await db.from("assets").delete().eq("id", asset.id);

  if (error) {
    throw new Error(`Database delete failed: ${error.message}`);
  }
}

/**
 * Find orphaned files in storage (present in bucket but not referenced by any assets row).
 *
 * Algorithm — JS-side diff (suitable for < ~10k files, which covers the current fleet):
 *  1. List all storage objects via storage.list("").
 *  2. Load all content_ref values from the assets table, paged 1000 at a time.
 *  3. Return storage objects whose key is absent from the assets set.
 *
 * Note: storage.list() is bounded by provider limits (~1000 for Supabase/R2).
 * For buckets exceeding that, the StorageProvider interface would need cursor
 * support — tracked as a future improvement.
 */
export async function findOrphanedFiles(
  db: SupabaseClient,
  storage: StorageProvider
): Promise<Array<{ key: string; size: number; lastModified: Date }>> {
  const storageObjects = await storage.list("");
  if (storageObjects.length === 0) return [];

  // Page through assets table to build the set of known storage keys
  const knownKeys = new Set<string>();
  const PAGE_SIZE = 1000;
  let offset = 0;

  while (true) {
    const { data, error } = await db
      .from("assets")
      .select("content_ref")
      .not("content_ref", "is", null)
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      logger.error({ err: error }, "[cleanup] failed to query assets for orphan detection");
      return [];
    }

    for (const row of data ?? []) {
      if (row.content_ref) knownKeys.add(row.content_ref as string);
    }

    if (!data || data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  const orphans = storageObjects
    .filter((obj) => !knownKeys.has(obj.key))
    .map((obj) => ({ key: obj.key, size: obj.size, lastModified: obj.lastModified }));

  logger.info({ orphan_count: orphans.length }, "[cleanup] orphaned files detected");

  return orphans;
}
