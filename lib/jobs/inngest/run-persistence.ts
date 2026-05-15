/**
 * Persistance runs pour les Inngest jobs media.
 *
 * Crée une row dans `runs` au début du job (status="running") et la met à jour
 * à la fin avec cost_usd réel + status final. Permet à /admin/analytics
 * d'agréger les coûts de tous les types de jobs (media inclus).
 *
 * tenant_id + user_id sont obligatoires pour l'agrégation correcte par tenant.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database.types";

type DB = SupabaseClient<Database>;
type RunKind = Database["public"]["Enums"]["run_kind"];

export interface StartJobRunArgs {
  kind: RunKind;
  userId?: string | null;
  tenantId?: string | null;
  input: Json;
  eventId: string;
}

/**
 * Insère une row `runs` avec status="running".
 * Retourne l'id de la run créée, ou null si Supabase est indisponible ou en erreur.
 * Fail-soft : une erreur de persistence ne doit jamais bloquer le job.
 */
export async function startJobRun(sb: DB, args: StartJobRunArgs): Promise<string | null> {
  const { data, error } = await sb
    .from("runs")
    .insert({
      kind: args.kind,
      status: "running",
      trigger: "inngest",
      user_id: args.userId ?? null,
      tenant_id: args.tenantId ?? null,
      input: args.input,
      started_at: new Date().toISOString(),
      metadata: { event_id: args.eventId },
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[run-persistence] startJobRun failed:", error?.message);
    return null;
  }

  return data.id;
}

export interface EndJobRunArgs {
  runId: string | null;
  status: "completed" | "failed";
  costUsd?: number;
  output?: Json;
  error?: string;
}

/**
 * Met à jour la row `runs` avec le status final, le coût réel et la sortie.
 * Fail-soft : si runId est null (startJobRun a échoué), ne fait rien.
 */
export async function endJobRun(sb: DB, args: EndJobRunArgs): Promise<void> {
  if (!args.runId) return;

  const { error } = await sb
    .from("runs")
    .update({
      status: args.status,
      cost_usd: args.costUsd ?? 0,
      output: args.output ?? {},
      error: args.error ?? null,
      finished_at: new Date().toISOString(),
    })
    .eq("id", args.runId);

  if (error) {
    console.error("[run-persistence] endJobRun failed:", error.message);
  }
}
