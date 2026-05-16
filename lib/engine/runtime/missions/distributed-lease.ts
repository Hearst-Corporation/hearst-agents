/**
 * Distributed Mission Lease — cross-instance duplicate prevention.
 *
 * Uses `scheduler_leases` table with key = "mission_run:<missionId>:<windowKey>"
 * to ensure only one instance executes a given mission in a given time window.
 *
 * The in-memory lease (lease.ts) remains the fast same-process guard;
 * this module is the cross-instance backstop.
 *
 * Falls back gracefully if DB is unavailable (allows execution).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerSupabase } from "@/lib/platform/db/supabase";
import { INSTANCE_ID } from "../instance-id";

const DEFAULT_TTL_S = 300; // 5 min — generous for long-running missions

function db(): SupabaseClient | null {
  return getServerSupabase();
}

function leaseKey(missionId: string, runWindowKey: string): string {
  return `mission_run:${missionId}:${runWindowKey}`;
}

/**
 * Try to acquire a per-mission execution lease for a specific time window.
 * Returns true if this instance won the lock.
 */
export async function tryAcquireMissionLease(input: {
  missionId: string;
  runWindowKey: string;
  instanceId?: string;
  ttlSeconds?: number;
}): Promise<boolean> {
  const sb = db();
  if (!sb) return true; // no DB → allow (single-instance dev)

  const id = input.instanceId ?? INSTANCE_ID;
  const ttl = input.ttlSeconds ?? DEFAULT_TTL_S;
  const key = leaseKey(input.missionId, input.runWindowKey);
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

  try {
    // Try insert first — fastest path if no row exists
    const { error: insertErr } = await sb.from("scheduler_leases").insert({
      key,
      instance_id: id,
      acquired_at: now,
      expires_at: expiresAt,
    });

    if (!insertErr) return true;

    // Row exists — try to take it only if expired
    const { data, error: updateErr } = await sb
      .from("scheduler_leases")
      .update({
        instance_id: id,
        acquired_at: now,
        expires_at: expiresAt,
      })
      .eq("key", key)
      .lt("expires_at", now)
      .select("instance_id")
      .single();

    if (updateErr || !data) return false;
    return data.instance_id === id;
  } catch (err) {
    console.error("[DistributedLease] Acquire error:", err);
    return true; // fail open — don't block execution on infra errors
  }
}

/**
 * Release a per-mission lease after execution completes.
 */
export async function releaseMissionLease(input: {
  missionId: string;
  runWindowKey: string;
  instanceId?: string;
}): Promise<void> {
  const sb = db();
  if (!sb) return;

  const id = input.instanceId ?? INSTANCE_ID;
  const key = leaseKey(input.missionId, input.runWindowKey);

  try {
    await sb.from("scheduler_leases").delete().eq("key", key).eq("instance_id", id);
  } catch (err) {
    console.error("[DistributedLease] Release error:", err);
  }
}
