/**
 * Lease Cleanup — deletes expired mission_run:* lease rows.
 *
 * Does NOT touch the active scheduler_leader row.
 * Safe to call periodically from the heartbeat loop.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerSupabase } from "@/lib/platform/db/supabase";

function db(): SupabaseClient | null {
  return getServerSupabase();
}

export async function cleanupExpiredSchedulerLeases(): Promise<{ deleted: number }> {
  const sb = db();
  if (!sb) return { deleted: 0 };

  try {
    const now = new Date().toISOString();

    const { data, error } = await sb
      .from("scheduler_leases")
      .delete()
      .like("key", "mission_run:%")
      .lt("expires_at", now)
      .select("key");

    if (error) {
      console.error("[LeaseCleanup] Error:", error.message);
      return { deleted: 0 };
    }

    return { deleted: data?.length ?? 0 };
  } catch (err) {
    console.error("[LeaseCleanup] Exception:", err);
    return { deleted: 0 };
  }
}
