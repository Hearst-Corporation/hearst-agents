/**
 * Inngest function — Code Execution (E2B sandbox).
 *
 * Migration du worker BullMQ `lib/jobs/workers/code-exec.ts` vers Inngest.
 * Découpé en steps pour retry par étape.
 *
 * Trigger : event `app/code-exec.requested`
 * Idempotency : event.id = deterministicHash(payload) posé par enqueueJob()
 */

import { Buffer } from "node:buffer";
import { updateVariant } from "@/lib/assets/variants";
import { executeCode } from "@/lib/capabilities/providers/e2b";
import { settleCredits } from "@/lib/credits/client";
import { getGlobalStorage } from "@/lib/engine/runtime/assets/storage";
import { inngest } from "@/lib/jobs/inngest/client";
import { endJobRun, startJobRun } from "@/lib/jobs/inngest/run-persistence";
import { PermanentJobError } from "@/lib/jobs/permanent-error";
import type { CodeExecInput } from "@/lib/jobs/types";
import { getServerSupabase } from "@/lib/platform/db/supabase";

// Coût estimé par exécution E2B (sandbox compute, estimation conservatrice)
const E2B_COST_PER_EXEC_USD = 0.001;

export const codeExecFunction = inngest.createFunction(
  {
    id: "code-exec",
    name: "Code Execution (E2B)",
    retries: 1,
    triggers: [{ event: "app/code-exec.requested" }],
  },
  async ({ event, step }) => {
    const payload = event.data as CodeExecInput;

    if (!payload.code || payload.code.trim().length === 0) {
      throw new PermanentJobError("code-exec: code is empty");
    }
    if (payload.runtime !== "python" && payload.runtime !== "node") {
      throw new PermanentJobError(`code-exec: unsupported runtime "${payload.runtime}"`);
    }

    const sb = getServerSupabase();

    const variantId =
      (payload as CodeExecInput & { variantId?: string }).variantId ??
      (typeof payload === "object" && payload !== null && "metadata" in payload
        ? (
            payload as {
              metadata?: { variantId?: string };
            }
          ).metadata?.variantId
        : undefined);

    // Step 0 — Créer la run au démarrage
    const runId = await step.run("create-run", async () => {
      if (!sb) return null;
      return startJobRun(sb, {
        kind: "code_exec",
        userId: payload.userId,
        tenantId: payload.tenantId,
        input: {
          assetId: payload.assetId,
          runtime: payload.runtime,
          codeLength: payload.code?.length,
          timeoutMs: payload.timeoutMs,
          estimatedCostUsd: payload.estimatedCostUsd,
        },
        eventId: event.id ?? "unknown",
      });
    });

    try {
      // Step 1 — Execute in E2B sandbox
      const execResult = await step.run("execute-code", async () => {
        try {
          return await executeCode({
            code: payload.code,
            language: payload.runtime === "node" ? "javascript" : "python",
            timeoutMs: payload.timeoutMs,
            idempotencyKey: `exec-${event.id}`,
          });
        } catch (err) {
          const status = (err as { status?: number }).status;
          if (status === 401 || status === 403) {
            throw new PermanentJobError("E2B auth failed", err);
          }
          if (status === 400) {
            throw new PermanentJobError("Invalid E2B request", err);
          }
          throw err;
        }
      });

      // Step 2 — Upload result JSON to storage
      const upload = await step.run("upload-result", async () => {
        const storage = getGlobalStorage();
        const variantKey = variantId ?? `exec-${event.id}`;
        const storageKey = `code-exec/${payload.assetId ?? "orphan"}/${variantKey}.json`;

        const resultJson = JSON.stringify(execResult, null, 2);
        return await storage.upload(storageKey, Buffer.from(resultJson, "utf-8"), {
          contentType: "application/json",
          tenantId: payload.tenantId,
          metadata: {
            userId: payload.userId,
            runtime: payload.runtime,
            hasError: execResult.error ? "1" : "0",
          },
        });
      });

      // Step 3 — Update DB row asset_variants
      await step.run("update-variant", async () => {
        if (!variantId) return null;
        return await updateVariant(variantId, {
          status: execResult.error ? "failed" : "ready",
          storageUrl: upload.url,
          mimeType: "application/json",
          sizeBytes: upload.size,
          generatedAt: Date.now(),
          provider: "e2b",
          metadata: {
            runtime: payload.runtime,
            error: execResult.error,
            stdoutLen: execResult.stdout.length,
          },
        });
      });

      // Step 4 — Settle credits
      await step.run("settle-credits", async () => {
        if (!payload.userId || !payload.tenantId) return null;
        return await settleCredits({
          userId: payload.userId,
          tenantId: payload.tenantId,
          reservedUsd: payload.estimatedCostUsd,
          actualUsd: E2B_COST_PER_EXEC_USD,
          jobId: event.id ?? "unknown",
          jobKind: "code-exec",
          description: `code-exec via e2b (${payload.runtime})`,
        }).catch((err) => {
          console.error("[code-exec/Inngest] settle_credits failed:", err);
        });
      });

      // Step 5 — Persister la run avec cost réel
      await step.run("end-run", async () => {
        if (!sb) return;
        await endJobRun(sb, {
          runId,
          status: "completed",
          costUsd: E2B_COST_PER_EXEC_USD,
          output: {
            assetId: payload.assetId,
            variantId,
            storageUrl: upload.url,
            runtime: payload.runtime,
            hasError: !!execResult.error,
            stdoutLen: execResult.stdout.length,
          },
        });
      });

      return {
        assetId: payload.assetId,
        variantId,
        storageUrl: upload.url,
        actualCostUsd: E2B_COST_PER_EXEC_USD,
        providerUsed: "e2b",
        modelUsed: `e2b-${payload.runtime}`,
        metadata: {
          stdout: execResult.stdout.slice(0, 500),
          stderr: execResult.stderr.slice(0, 500),
          error: execResult.error,
          resultsCount: execResult.results.length,
        },
      };
    } catch (err) {
      // Marquer la run en failed — fail-soft, ne masque pas l'erreur originale
      if (sb) {
        await endJobRun(sb, {
          runId,
          status: "failed",
          error: err instanceof Error ? err.message : String(err),
        }).catch(() => {});
      }
      throw err;
    }
  },
);
