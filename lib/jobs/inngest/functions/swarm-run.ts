/**
 * Inngest function — Swarm Run (hive-engine, swarms.hearst.app).
 *
 * Lance un swarm CrewAI distant et le poll jusqu'à complétion (4-8 min).
 * Chaque run est tracé dans la table `runs` (kind="swarm") → visible dans les
 * dashboards (points de contrôle : /admin/runs, RunRail, /api/v2/runs).
 *
 * Pattern durable : kickoff → step.sleep + step.run (poll) en boucle. Inngest
 * dort entre les polls sans tenir de slot serverless. Aucun await bloquant.
 *
 * Trigger : event `app/swarm-run.requested`
 * Idempotency : event.id = deterministicHash(payload) posé par enqueueJob().
 */

import { inngest } from "@/lib/jobs/inngest/client";
import { endJobRun } from "@/lib/jobs/inngest/run-persistence";
import { PermanentJobError } from "@/lib/jobs/permanent-error";
import type { SwarmRunInput } from "@/lib/jobs/types";
import { getServerSupabase } from "@/lib/platform/db/supabase";
import { getSwarmRun, kickoffSwarm } from "@/lib/swarms/client";

// Le run Helm est pré-créé côté tool (status "running") → ici on UPDATE seulement.
const MAX_POLLS = 60; // 60 × 8s ≈ 8 min max
const POLL_INTERVAL = "8s";

export const swarmRunFunction = inngest.createFunction(
  {
    id: "swarm-run",
    name: "Swarm Run (hive-engine)",
    retries: 1,
    triggers: [{ event: "app/swarm-run.requested" }],
  },
  async ({ event, step }) => {
    const payload = event.data as SwarmRunInput;
    if (!payload.swarmId) throw new PermanentJobError("swarm-run: swarmId manquant");

    const sb = getServerSupabase();
    const helmRunId = payload.runId;

    // Step 1 — kickoff distant : récupère le run_id du moteur.
    const kicked = await step.run("kickoff-swarm", async () => {
      const res = await kickoffSwarm(payload.swarmId, payload.context ?? {});
      if (!res.ok || !res.runId) {
        throw new Error(`kickoff échoué: ${res.error ?? "no run_id"}`);
      }
      return { engineRunId: res.runId };
    });

    // Step 2 — poll jusqu'à complétion (step.sleep entre chaque, durable).
    let final: { status: string; resultText?: string; tokensIn?: number; tokensOut?: number } = {
      status: "running",
    };
    for (let i = 0; i < MAX_POLLS; i++) {
      await step.sleep(`wait-${i}`, POLL_INTERVAL);
      const polled = await step.run(`poll-${i}`, async () => {
        const s = await getSwarmRun(payload.swarmId, kicked.engineRunId);
        return {
          ok: s.ok,
          status: s.status ?? "running",
          resultText: s.resultText,
          tokensIn: s.tokensIn,
          tokensOut: s.tokensOut,
        };
      });
      if (polled.ok && (polled.status === "completed" || polled.status === "failed")) {
        final = polled;
        break;
      }
    }

    // Step 3 — persister le résultat dans `runs` (visible dashboards).
    await step.run("end-run", async () => {
      if (!sb) return;
      await endJobRun(sb, {
        runId: helmRunId,
        status: final.status === "completed" ? "completed" : "failed",
        output: {
          swarmId: payload.swarmId,
          swarmName: payload.swarmName,
          engineRunId: kicked.engineRunId,
          resultText: final.resultText ?? "",
          tokensIn: final.tokensIn ?? 0,
          tokensOut: final.tokensOut ?? 0,
        },
        error: final.status === "completed" ? undefined : `swarm ${final.status}`,
      }).catch(() => {});
    });

    return {
      swarmId: payload.swarmId,
      engineRunId: kicked.engineRunId,
      status: final.status,
      resultText: final.resultText,
    };
  },
);
