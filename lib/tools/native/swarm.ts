/**
 * Tool natif `kickoff_swarm` — lance un swarm de réflexion multi-agent
 * (hive-engine, swarms.hearst.app) en ASYNCHRONE via Inngest.
 *
 * Le swarm tourne 4-8 min → on NE l'attend JAMAIS dans le tour de chat. On crée
 * une run tracée (table `runs`, kind="swarm", visible dans les dashboards) puis
 * on enqueue un job Inngest `swarm-run` qui poll le moteur et persiste le résultat.
 * Le tool retourne immédiatement le runId (le user suit l'avancement dans l'UI).
 */

import type { Tool } from "ai";
import { jsonSchema } from "ai";
import type { Json } from "@/lib/database.types";
import { startJobRun } from "@/lib/jobs/inngest/run-persistence";
import { enqueueJob } from "@/lib/jobs/queue";
import type { TenantScope } from "@/lib/multi-tenant/types";
import { getServerSupabase } from "@/lib/platform/db/supabase";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AiToolMap = Record<string, Tool<any, any>>;

interface KickoffSwarmArgs {
  swarm_id: string;
  context?: Record<string, unknown>;
}

export function buildSwarmTools(opts: { scope: TenantScope }): AiToolMap {
  const { userId, tenantId, workspaceId } = opts.scope;

  const kickoffSwarmTool: Tool<KickoffSwarmArgs, unknown> = {
    description:
      "Lance un SWARM de réflexion multi-agent (hive-engine) pour une tâche complexe " +
      "qui dépasse une réponse directe : analyse approfondie, revue de projet, recherche " +
      "multi-source, audit de décision. Le swarm tourne en arrière-plan (plusieurs minutes) " +
      "et son run est tracé dans les dashboards. Use this quand l'utilisateur demande une " +
      "'analyse complète', 'revue', 'recherche approfondie', 'audit', ou un travail qui " +
      "nécessite plusieurs agents en parallèle. NE PAS utiliser pour une réponse simple. " +
      "Swarms disponibles (utilise l'UUID exact comme swarm_id) : " +
      "'bfe5d377-15a6-45a2-8536-7ebd89b9141e' (Cortex Note Action Advisor — analyse une note), " +
      "'48b401ac-3a11-43bb-b032-c663203cd402' (Revue de projet), " +
      "'aaaaaaaa-0002-0002-0002-000000000002' (Deep Research Agent — recherche approfondie), " +
      "'aaaaaaaa-0001-0001-0001-000000000001' (Market Intelligence Scout), " +
      "'7c4d9ac9-778c-4731-b287-e42c45e40f86' (EmailAssistant). " +
      "Retourne un run_id suivi dans les dashboards.",
    inputSchema: jsonSchema<KickoffSwarmArgs>({
      type: "object",
      required: ["swarm_id"],
      properties: {
        swarm_id: {
          type: "string",
          description: "ID ou slug du swarm à lancer (ex: 'revue-projet', 'Deep Research Agent').",
        },
        context: {
          type: "object",
          description: "Contexte passé au swarm (ex: { query, project, note_path }). Optionnel.",
          additionalProperties: true,
        },
      },
    }),
    execute: async (args) => {
      const swarmId = (args.swarm_id ?? "").trim();
      if (!swarmId) return "Erreur : swarm_id vide.";
      if (!userId || !tenantId) return "Erreur : session sans tenant — swarm non lancé.";

      try {
        const sb = getServerSupabase();
        // Run tracée AVANT l'enqueue → visible immédiatement dans les dashboards.
        const runId = sb
          ? await startJobRun(sb, {
              kind: "swarm",
              userId,
              tenantId,
              input: { swarmId, context: args.context ?? {} } as unknown as Json,
              eventId: `swarm-${Date.now()}`,
            })
          : null;

        if (!runId) return "Erreur : impossible de créer la run (DB indisponible).";

        await enqueueJob({
          jobKind: "swarm-run",
          userId,
          tenantId,
          workspaceId,
          estimatedCostUsd: 0,
          swarmId,
          context: args.context ?? {},
          runId,
        });

        return (
          `Swarm « ${swarmId} » lancé (run ${runId.slice(0, 8)}). ` +
          `Il tourne en arrière-plan (quelques minutes) — suis l'avancement dans les runs. ` +
          `Je te préviens quand le résultat est prêt.`
        );
      } catch (err) {
        console.error("[kickoff_swarm] failed:", err instanceof Error ? err.name : err);
        return `Erreur lancement swarm : ${err instanceof Error ? err.name : "unknown"}`;
      }
    },
  };

  return { kickoff_swarm: kickoffSwarmTool };
}
