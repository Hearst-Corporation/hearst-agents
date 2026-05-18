/**
 * Inngest function — Image Generation (fal.ai).
 *
 * Migration du worker BullMQ `lib/jobs/workers/image-gen.ts` vers Inngest.
 * Découpé en steps pour retry par étape.
 *
 * Trigger : event `app/image-gen.requested`
 * Idempotency : event.id = deterministicHash(payload) posé par enqueueJob()
 */

import { Buffer } from "node:buffer";
import { updateVariant } from "@/lib/assets/variants";
import { FAL_DEFAULT_MODEL, FAST_MODEL, falGenerate } from "@/lib/capabilities/providers/fal";
import {
  type EnrichMode,
  enrichPrompt,
  isFastModeRequested,
} from "@/lib/capabilities/providers/fal-prompt-enricher";
import { settleCredits } from "@/lib/credits/client";
import { computeGenerationHash, findDuplicateAsset } from "@/lib/engine/runtime/assets/dedup";
import { getGlobalStorage } from "@/lib/engine/runtime/assets/storage";
import { inngest } from "@/lib/jobs/inngest/client";
import { endJobRun, startJobRun } from "@/lib/jobs/inngest/run-persistence";
import { PermanentJobError } from "@/lib/jobs/permanent-error";
import type { ImageGenInput } from "@/lib/jobs/types";
import { getServerSupabase } from "@/lib/platform/db/supabase";

// Coût estimé par image fal.ai (pas de billing API dispo, estimation conservatrice)
const FAL_COST_PER_IMAGE_USD = 0.003;

export const imageGenFunction = inngest.createFunction(
  {
    id: "image-gen",
    name: "Image Generation (fal.ai)",
    retries: 2,
    triggers: [{ event: "app/image-gen.requested" }],
  },
  async ({ event, step }) => {
    const payload = event.data as ImageGenInput;

    if (!payload.prompt || payload.prompt.trim().length === 0) {
      throw new PermanentJobError("image-gen: prompt is empty");
    }

    const sb = getServerSupabase();
    const style: EnrichMode = (payload.style as EnrichMode) ?? "editorial";
    const enriched = enrichPrompt(payload.prompt, style);
    const fastRequested = isFastModeRequested(payload.prompt);
    const model = payload.modelHint ?? (fastRequested ? FAST_MODEL : FAL_DEFAULT_MODEL);

    const variantId =
      (payload as ImageGenInput & { variantId?: string }).variantId ??
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
        kind: "image_gen",
        userId: payload.userId,
        tenantId: payload.tenantId,
        input: {
          assetId: payload.assetId,
          model,
          style,
          promptLength: payload.prompt?.length,
          estimatedCostUsd: payload.estimatedCostUsd,
        },
        eventId: event.id ?? "unknown",
      });
    });

    // Dedup — même (provider + model + prompt + params) = même asset en cache
    const generationHash = computeGenerationHash({
      provider: "fal",
      model,
      prompt: enriched.prompt,
      negativePrompt: enriched.negative_prompt,
      numInferenceSteps: enriched.params.num_inference_steps,
      guidanceScale: enriched.params.guidance_scale,
      imageSize: enriched.params.image_size,
    });

    if (payload.tenantId) {
      const existingKey = await findDuplicateAsset(payload.tenantId, generationHash);
      if (existingKey) {
        console.info("[image-gen/Inngest] dedup hit — skipping generation", {
          existingKey,
          hash: generationHash,
        });
        // Fermer la run en completed avec cost=0 (dedup = pas de génération)
        if (sb) {
          await endJobRun(sb, {
            runId,
            status: "completed",
            costUsd: 0,
            output: { assetId: payload.assetId, variantId, storageKey: existingKey, dedup: true },
          });
        }
        return {
          assetId: payload.assetId,
          variantId,
          storageKey: existingKey,
          deduplicated: true,
          actualCostUsd: 0,
          providerUsed: "fal",
          modelUsed: model,
          metadata: { style, model, dedup: true },
        };
      }
    }

    try {
      // Step 1 — fal.ai generation
      const images = await step.run("generate-image", async () => {
        try {
          return await falGenerate({
            prompt: enriched.prompt,
            model,
            negativePrompt: enriched.negative_prompt,
            numInferenceSteps: enriched.params.num_inference_steps,
            guidanceScale: enriched.params.guidance_scale,
            imageSize: enriched.params.image_size,
            idempotencyKey: `image-${event.id}`,
          });
        } catch (err) {
          const status = (err as { status?: number }).status;
          if (status === 401 || status === 403) {
            throw new PermanentJobError("fal.ai auth failed", err);
          }
          if (status === 400) {
            throw new PermanentJobError("Invalid fal.ai request", err);
          }
          throw err;
        }
      });

      if (images.length === 0) {
        console.error("[image-gen/Inngest] fal.ai returned no images for event", event.id);
        if (sb) {
          await endJobRun(sb, {
            runId,
            status: "failed",
            costUsd: 0,
            error: "fal.ai returned no images",
          });
        }
        // P1-6 — variante orpheline : sans génération réussie, la variante
        // resterait 'generating'. On la passe 'failed' (idem catch global).
        if (variantId) {
          await step
            .run("mark-variant-failed-no-images", async () => {
              await updateVariant(variantId, { status: "failed" });
              return null;
            })
            .catch(() => {});
        }
        return {
          assetId: payload.assetId,
          variantId,
          actualCostUsd: 0,
          providerUsed: "fal",
          modelUsed: model,
          metadata: { error: "no images returned", style, model },
        };
      }

      const image = images[0];
      // Coût réel = nombre d'images générées × coût unitaire estimé
      const actualCostUsd = images.length * FAL_COST_PER_IMAGE_USD;

      // Step 2 — Download + Upload combinés dans un seul step.
      // Inngest sérialise les retours de step.run en JSON — un Buffer brut
      // serait dégradé en `{type:"Buffer",data:[...]}` s'il traversait une
      // frontière de step. En combinant download + upload, le Buffer reste
      // en mémoire dans le même contexte d'exécution.
      const upload = await step.run("download-and-upload-image", async () => {
        const imgRes = await fetch(image.url, { signal: AbortSignal.timeout(30_000) });
        if (!imgRes.ok) {
          throw new Error(`image-gen: failed to fetch image from fal.ai: ${imgRes.status}`);
        }
        const imgBuffer = Buffer.from(await imgRes.arrayBuffer());

        const storage = getGlobalStorage();
        const variantKey = variantId ?? `image-${event.id}`;
        const storageKey = `images/${payload.assetId ?? "orphan"}/${variantKey}.jpg`;

        return await storage.upload(storageKey, imgBuffer, {
          contentType: "image/jpeg",
          tenantId: payload.tenantId,
          metadata: {
            userId: payload.userId,
            width: String(image.width),
            height: String(image.height),
            prompt: payload.prompt.slice(0, 200),
            enrichedPrompt: enriched.prompt.slice(0, 300),
            style,
            model,
          },
        });
      });

      // Step 3 — Update DB row asset_variants
      await step.run("update-variant", async () => {
        if (!variantId) return null;
        return await updateVariant(variantId, {
          status: "ready",
          storageUrl: upload.url,
          mimeType: "image/jpeg",
          sizeBytes: upload.size,
          generatedAt: Date.now(),
          provider: "fal",
          // generation_hash stocké fail-soft : ignoré si colonne absente en DB
          generationHash,
          metadata: {
            width: image.width,
            height: image.height,
            model,
            style,
            enrichedPrompt: enriched.prompt,
            numInferenceSteps: enriched.params.num_inference_steps,
            guidanceScale: enriched.params.guidance_scale,
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
          actualUsd: actualCostUsd,
          jobId: event.id ?? "unknown",
          jobKind: "image-gen",
          description: `image-gen via fal (${model})`,
        }).catch((err) => {
          console.error("[image-gen/Inngest] settle_credits failed:", err);
        });
      });

      // Step 5 — Persister la run avec cost réel
      await step.run("end-run", async () => {
        if (!sb) return;
        await endJobRun(sb, {
          runId,
          status: "completed",
          costUsd: actualCostUsd,
          output: {
            assetId: payload.assetId,
            variantId,
            storageUrl: upload.url,
            width: image.width,
            height: image.height,
            model,
            style,
          },
        });
      });

      return {
        assetId: payload.assetId,
        variantId,
        storageUrl: upload.url,
        actualCostUsd,
        providerUsed: "fal",
        modelUsed: model,
        metadata: {
          width: image.width,
          height: image.height,
          style,
          enrichedPrompt: enriched.prompt,
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
      // P1-6 — Marquer aussi la variante en 'failed'. Sans ça la variante
      // reste 'generating' indéfiniment → spinner UI infini côté asset.
      // Même pattern de cleanup variant que video-gen (updateVariant status).
      // Step isolé : si updateVariant échoue, on ne masque pas l'erreur run.
      if (variantId) {
        await step
          .run("mark-variant-failed", async () => {
            await updateVariant(variantId, { status: "failed" });
            return null;
          })
          .catch(() => {});
      }
      throw err;
    }
  },
);
