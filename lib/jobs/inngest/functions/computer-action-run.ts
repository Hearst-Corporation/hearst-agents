/**
 * Inngest function — Computer Action Run (HEARST.AI core/).
 *
 * Appelle l'API distante HEARST.AI core/ (POST /task) pour exécuter une action
 * computer-use. L'appel peut durer jusqu'à 300s — Inngest le supporte nativement
 * via step.run (durable, pas de limite Vercel 120s).
 *
 * Chaque run est tracé dans la table `runs` (kind="computer_action") → visible
 * dans les dashboards.
 *
 * Statuts possibles retournés par l'API :
 *   - "completed"             → action terminée avec succès
 *   - "blocked"               → l'agent a été bloqué (CAPTCHA, auth requise…)
 *   - "confirmation_required" → l'agent attend une confirmation humaine
 *   - erreur réseau / timeout → échec
 *
 * Note HITL : l'API /task de HEARST.AI core/ n'expose pas de token de reprise.
 * Les statuts awaiting_approval / awaiting_clarification signalent à l'humain
 * qu'une action manuelle est requise — le resume bidirectionnel n'est pas possible
 * dans ce contrat. Une notification in-app est émise pour chaque cas HITL.
 *
 * Trigger : event `app/computer-action-run.requested`
 * Idempotency : event.id = deterministicHash(payload) posé par enqueueJob().
 */

import type { Json } from "@/lib/database.types";
import {
  type ComputerActionResult,
  sendComputerAction,
} from "@/lib/integrations/hearst-action-client";
import { inngest } from "@/lib/jobs/inngest/client";
import { endJobRun } from "@/lib/jobs/inngest/run-persistence";
import { PermanentJobError } from "@/lib/jobs/permanent-error";
import type { ComputerActionRunInput } from "@/lib/jobs/types";
import { pushArtifactToCortex } from "@/lib/memory/cortex-client";
import { createNotification } from "@/lib/notifications/in-app";
import { getServerSupabase } from "@/lib/platform/db/supabase";

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Mappe le résultat de l'API HEARST.AI core/ vers :
 *   - runStatus : statut à écrire dans `runs`
 *   - notify    : payload de notification à envoyer (null si pas de notif)
 *
 * Extrait en fonction pure pour faciliter les tests unitaires.
 */
export function mapActionResultToRunStatus(actionResult: ComputerActionResult): {
  runStatus: "completed" | "failed" | "awaiting_approval" | "awaiting_clarification";
  errorMsg: string | undefined;
  needsHuman: boolean;
  notifyTitle: string | null;
  notifyBody: string;
} {
  if (!actionResult.ok) {
    return {
      runStatus: "failed",
      errorMsg: actionResult.error ?? "action échouée",
      needsHuman: false,
      notifyTitle: null,
      notifyBody: "",
    };
  }

  if (actionResult.status === "confirmation_required") {
    return {
      runStatus: "awaiting_approval",
      errorMsg: undefined,
      needsHuman: true,
      notifyTitle: "Action computer-use : confirmation requise",
      notifyBody:
        actionResult.reply?.trim() || "L'agent attend une confirmation humaine avant de continuer.",
    };
  }

  if (actionResult.status === "blocked") {
    return {
      runStatus: "awaiting_clarification",
      errorMsg: undefined,
      needsHuman: true,
      notifyTitle: "Action bloquée — intervention requise",
      notifyBody:
        actionResult.reply?.trim() ||
        "L'agent a été bloqué (CAPTCHA ou authentification requise). Une action manuelle est nécessaire.",
    };
  }

  // Default: completed
  return {
    runStatus: "completed",
    errorMsg: undefined,
    needsHuman: false,
    notifyTitle: null,
    notifyBody: "",
  };
}

// ── Inngest function ───────────────────────────────────────────────────────

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

    // Persiste le résultat + émet une notif HITL si nécessaire.
    await step.run("end-run", async () => {
      if (!sb) return;

      const { runStatus, errorMsg, needsHuman, notifyTitle, notifyBody } =
        mapActionResultToRunStatus(actionResult);

      await endJobRun(sb, {
        runId: helmRunId,
        status: runStatus,
        output: {
          task: payload.task,
          status: actionResult.status ?? "unknown",
          reply: actionResult.reply ?? "",
          needs_human: needsHuman,
          // result/route peuvent être n'importe quel JSON — cast explicite.
          result: (actionResult.result ?? null) as Json,
          route: (actionResult.route ?? null) as Json,
          error: actionResult.error ?? null,
        } as Json,
        error: errorMsg,
      }).catch(() => {});

      // Notification HITL — fail-soft : un échec d'envoi ne doit jamais faire
      // échouer le job.
      if (needsHuman && notifyTitle && payload.tenantId) {
        await createNotification(sb, {
          tenantId: payload.tenantId,
          userId: payload.userId ?? undefined,
          kind: "signal",
          severity: "warning",
          title: notifyTitle,
          body: notifyBody.slice(0, 500),
          meta: {
            subtype: "computer_action_hitl",
            runId: helmRunId,
            runStatus,
            task: payload.task,
          },
        }).catch(() => {});
      }
    });

    // Ré-ingestion mémoire Cortex (ROADMAP #5 : la mémoire grandit de ses propres
    // actions). On ne pousse que les runs "completed" — les HITL / failed ne doivent
    // pas polluer la mémoire avec des artefacts incomplets. Fail-soft total.
    await step.run("push-to-cortex", async () => {
      const { runStatus } = mapActionResultToRunStatus(actionResult);
      if (runStatus !== "completed") return;
      await pushArtifactToCortex({
        kind: "action",
        task: payload.task,
        result: actionResult.reply?.trim() || "(action terminée sans reply)",
        userId: payload.userId ?? "",
        tenantId: payload.tenantId,
        runId: helmRunId,
        extraMeta: {
          actionStatus: actionResult.status,
          route: actionResult.route ?? null,
        },
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
