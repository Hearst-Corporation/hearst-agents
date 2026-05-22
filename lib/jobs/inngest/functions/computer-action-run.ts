/**
 * Inngest function — Computer Action Run (HEARST.AI core/).
 *
 * Appelle l'API distante HEARST.AI core/ (POST /task) pour exécuter une action
 * computer-use. L'appel peut durer jusqu'à 300s — Inngest le supporte nativement
 * via step.run (durable, pas de limite Vercel 120s).
 *
 * Chaque run est tracé dans la table `runs` (kind="computer-action") → visible
 * dans les dashboards.
 *
 * Statuts possibles retournés par l'API :
 *   - "completed"             → action terminée avec succès
 *   - "blocked"               → l'agent a été bloqué (CAPTCHA, auth requise…)
 *   - "confirmation_required" → l'agent attend une confirmation humaine
 *   - erreur réseau / timeout → échec
 *
 * Trigger : event `app/computer-action-run.requested`
 * Idempotency : event.id = deterministicHash(payload) posé par enqueueJob().
 */

import type { Json } from "@/lib/database.types";
import { sendComputerAction } from "@/lib/integrations/hearst-action-client";
import { inngest } from "@/lib/jobs/inngest/client";
import { endJobRun } from "@/lib/jobs/inngest/run-persistence";
import { PermanentJobError } from "@/lib/jobs/permanent-error";
import type { ComputerActionRunInput } from "@/lib/jobs/types";
import { getServerSupabase } from "@/lib/platform/db/supabase";

export const computerActionRunFunction = inngest.createFunction(
  {
    id: "computer-action-run",
    name: "Computer Action Run (HEARST.AI core/)",
    retries: 1,
    triggers: [{ event: "app/computer-action-run.requested" }],
  },
  async ({ event, step }) => {
    const payload = event.data as ComputerActionRunInput;
    if (!payload.task?.trim()) {
      throw new PermanentJobError("computer-action-run: task manquante");
    }

    const sb = getServerSupabase();
    const helmRunId = payload.runId;

    // Step unique — l'await peut durer jusqu'à 300s (Inngest durable, safe).
    const actionResult = await step.run("send-computer-action", async () => {
      const res = await sendComputerAction({
        task: payload.task,
        context: payload.context,
        tenantId: payload.tenantId,
      });
      return res;
    });

    // Persiste le résultat dans `runs` (visible dashboards).
    await step.run("end-run", async () => {
      if (!sb) return;

      const isSuccess = actionResult.ok && actionResult.status === "completed";
      const isFailed =
        !actionResult.ok ||
        actionResult.status === "blocked" ||
        actionResult.status === "confirmation_required";

      let errorMsg: string | undefined;
      if (!actionResult.ok) {
        errorMsg = actionResult.error ?? "action échouée";
      } else if (actionResult.status === "blocked") {
        errorMsg = "Agent bloqué (CAPTCHA ou auth requise) — intervention manuelle nécessaire";
      } else if (actionResult.status === "confirmation_required") {
        errorMsg = "L'agent attend une confirmation humaine";
      }

      await endJobRun(sb, {
        runId: helmRunId,
        status: isSuccess ? "completed" : "failed",
        output: {
          task: payload.task,
          status: actionResult.status ?? "unknown",
          reply: actionResult.reply ?? "",
          // result/route peuvent être n'importe quel JSON — cast explicite.
          result: (actionResult.result ?? null) as Json,
          route: (actionResult.route ?? null) as Json,
          error: actionResult.error ?? null,
        } as Json,
        error: isFailed ? errorMsg : undefined,
      }).catch(() => {});
    });

    return {
      task: payload.task,
      status: actionResult.status,
      reply: actionResult.reply,
      ok: actionResult.ok,
    };
  },
);
