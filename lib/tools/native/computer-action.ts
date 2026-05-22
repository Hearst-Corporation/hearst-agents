/**
 * Tool natif `start_computer_action` — déclenche une action computer-use distante
 * (HEARST.AI core/) en ASYNCHRONE via Inngest.
 *
 * L'exécution distante peut durer jusqu'à 300s → on NE l'attend JAMAIS dans le
 * tour de chat. On crée une run tracée (table `runs`, kind="computer-action")
 * puis on enqueue un job Inngest `computer-action-run` qui appelle l'API et
 * persiste le résultat. Le tool retourne immédiatement le runId.
 *
 * Gating : ce tool est réservé au tier « action » (gateToolsByTier).
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

interface StartComputerActionArgs {
  task: string;
  context?: Record<string, unknown>;
}

export function buildComputerActionTools(opts: { scope: TenantScope }): AiToolMap {
  const { userId, tenantId, workspaceId } = opts.scope;

  const startComputerActionTool: Tool<StartComputerActionArgs, unknown> = {
    description:
      "Déclenche une action computer-use sur HEARST.AI core/ (agent distant qui contrôle " +
      "un navigateur ou le desktop). À utiliser quand l'utilisateur demande de naviguer vers " +
      "un site, remplir un formulaire, cliquer sur un élément, télécharger un fichier, " +
      "se connecter à un service ou toute action qui nécessite un contrôle machine. " +
      "L'action tourne en arrière-plan (jusqu'à 5 min) — retourne immédiatement un runId " +
      "visible dans les dashboards.",
    inputSchema: jsonSchema<StartComputerActionArgs>({
      type: "object",
      required: ["task"],
      properties: {
        task: {
          type: "string",
          description:
            "Description précise de la tâche à exécuter (ex: 'Va sur apple.com et " +
            "clique sur le bouton Acheter du MacBook Pro 14\"').",
        },
        context: {
          type: "object",
          description: "Contexte optionnel passé à l'agent (ex: { url, credentials_ref, steps }).",
          additionalProperties: true,
        },
      },
    }),
    execute: async (args) => {
      const task = (args.task ?? "").trim();
      if (!task) return "Erreur : task vide — décris l'action à effectuer.";
      if (!userId || !tenantId) {
        return "Erreur : session sans tenant — action computer-use non lancée.";
      }

      try {
        const sb = getServerSupabase();
        // Run tracée AVANT l'enqueue → visible immédiatement dans les dashboards.
        const runId = sb
          ? await startJobRun(sb, {
              // TODO: migration — ajouter "computer_action" à l'enum run_kind DB.
              // En attendant on réutilise "tool_test" (neutre, visible dashboards).
              kind: "tool_test" as Parameters<typeof startJobRun>[1]["kind"],
              userId,
              tenantId,
              input: { task, context: args.context ?? {} } as unknown as Json,
              eventId: `computer-action-${Date.now()}`,
            })
          : null;

        if (!runId) return "Erreur : impossible de créer la run (DB indisponible).";

        await enqueueJob({
          jobKind: "computer-action-run",
          userId,
          tenantId,
          workspaceId,
          estimatedCostUsd: 0,
          task,
          context: args.context ?? {},
          runId,
        });

        return (
          `Action computer-use lancée (run ${runId.slice(0, 8)}). ` +
          `Elle s'exécute en arrière-plan (jusqu'à 5 min) — suis l'avancement dans les runs. ` +
          `Je te préviens quand le résultat est prêt.`
        );
      } catch (err) {
        console.error("[start_computer_action] failed:", err instanceof Error ? err.name : err);
        return `Erreur lancement action : ${err instanceof Error ? err.name : "unknown"}`;
      }
    },
  };

  return { start_computer_action: startComputerActionTool };
}
