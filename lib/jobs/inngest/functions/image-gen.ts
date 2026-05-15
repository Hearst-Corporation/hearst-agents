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
import { inngest } from "@/lib/jobs/inngest/client";
import { falGenerate, FAL_DEFAULT_MODEL, FAST_MODEL } from "@/lib/capabilities/providers/fal";
import {
  enrichPrompt,
  isFastModeRequested,
  type EnrichMode,
} from "@/lib/capabilities/providers/fal-prompt-enricher";
import { updateVariant } from "@/lib/assets/variants";
import { getGlobalStorage } from "@/lib/engine/runtime/assets/storage";
import { settleCredits } from "@/lib/credits/client";
import { PermanentJobError } from "@/lib/jobs/permanent-error";
import type { ImageGenInput } from "@/lib/jobs/types";

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

    const variantId =
      (payload as ImageGenInput & { variantId?: string }).variantId ??
      (typeof payload === "object" &&
      payload !== null &&
      "metadata" in payload
        ? (
            payload as {
              metadata?: { variantId?: string };
            }
          ).metadata?.variantId
        : undefined);

    const style: EnrichMode = (payload.style as EnrichMode) ?? "editorial";
    const enriched = enrichPrompt(payload.prompt, style);
    const fastRequested = isFastModeRequested(payload.prompt);
    const model = payload.modelHint ?? (fastRequested ? FAST_MODEL : FAL_DEFAULT_MODEL);

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

    // Step 4 — Update DB row asset_variants
    await step.run("update-variant", async () => {
      if (!variantId) return null;
      return await updateVariant(variantId, {
        status: "ready",
        storageUrl: upload.url,
        mimeType: "image/jpeg",
        sizeBytes: upload.size,
        generatedAt: Date.now(),
        provider: "fal",
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

    // Step 5 — Settle credits
    await step.run("settle-credits", async () => {
      if (!payload.userId || !payload.tenantId) return null;
      return await settleCredits({
        userId: payload.userId,
        tenantId: payload.tenantId,
        reservedUsd: payload.estimatedCostUsd,
        actualUsd: 0.003,
        jobId: event.id ?? "unknown",
        jobKind: "image-gen",
        description: `image-gen via fal (${model})`,
      }).catch((err) => {
        console.error("[image-gen/Inngest] settle_credits failed:", err);
      });
    });

    return {
      assetId: payload.assetId,
      variantId,
      storageUrl: upload.url,
      actualCostUsd: 0.003,
      providerUsed: "fal",
      modelUsed: model,
      metadata: {
        width: image.width,
        height: image.height,
        style,
        enrichedPrompt: enriched.prompt,
      },
    };
  },
);
