/**
 * Inbox Store — accès au dernier brief persisté pour un user.
 *
 * Source : table `assets` filtrée par `kind: "inbox_brief"` et
 * `provenance.userId === userId`. On retourne le row le plus récent.
 *
 * Le contenu réel du brief est dans `content_ref` (JSON stringifié).
 * Snooze : on persiste `snoozedUntil` directement sur l'item à l'intérieur
 * du JSON. Le snooze remet à jour l'asset (re-store avec items modifiés).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerSupabase } from "@/lib/platform/db/supabase";
import type { InboxBrief, InboxItem } from "./inbox-brief";

interface AssetRow {
  id: string;
  thread_id: string;
  kind: string;
  title: string;
  summary: string | null;
  content_ref: string | null;
  provenance: Record<string, unknown> | null;
  created_at: string;
}

function rawDb(sb: ReturnType<typeof getServerSupabase>): SupabaseClient | null {
  return sb as unknown as SupabaseClient | null;
}

export async function loadLatestInboxBrief(userId: string): Promise<InboxBrief | null> {
  const sb = getServerSupabase();
  if (!sb) return null;

  const { data, error } = await rawDb(sb)!
    .from("assets")
    .select("id, thread_id, kind, title, summary, content_ref, provenance, created_at")
    .eq("kind", "inbox_brief")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error || !data) return null;

  // Filtre côté app par userId (provenance) car la jsonb query SQL n'est
  // pas trivialement portable sans index.
  const rows = data as AssetRow[];
  for (const row of rows) {
    const prov = row.provenance ?? {};
    const ownerId = (prov as { userId?: string }).userId;
    if (ownerId !== userId) continue;

    if (!row.content_ref) continue;
    try {
      const parsed = JSON.parse(row.content_ref) as InboxBrief & { _assetId?: string };
      // Inject the assetId pour que les writes (snooze) puissent mettre à jour.
      return { ...parsed, _assetId: row.id } as InboxBrief & { _assetId?: string };
    } catch (err) {
      console.warn(`[inbox/store] failed to parse content_ref for asset ${row.id}:`, err);
    }
  }
  return null;
}


