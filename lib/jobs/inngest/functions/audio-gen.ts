/**
 * Inngest function — Audio Generation (ElevenLabs TTS).
 *
 * Migration du worker BullMQ `lib/jobs/workers/audio-gen.ts` vers Inngest.
 * Découpé en steps pour retry par étape. Appelle le même processor que le
 * worker BullMQ via `processAudioGen`.
 *
 * Trigger : event `app/audio-gen.requested`
 * Idempotency : event.id = deterministicHash(payload) posé par enqueueJob()
 */

import { updateVariant } from "@/lib/assets/variants";
import { synthesizeSpeech } from "@/lib/capabilities/providers/elevenlabs";
import { settleCredits } from "@/lib/credits/client";
import { computeGenerationHash, findDuplicateAsset } from "@/lib/engine/runtime/assets/dedup";
import { getGlobalStorage } from "@/lib/engine/runtime/assets/storage";
import { inngest } from "@/lib/jobs/inngest/client";
import { endJobRun, startJobRun } from "@/lib/jobs/inngest/run-persistence";
import { PermanentJobError } from "@/lib/jobs/permanent-error";
import type { AudioGenInput } from "@/lib/jobs/types";
import { getServerSupabase } from "@/lib/platform/db/supabase";

export const audioGenFunction = inngest.createFunction(
  {
    id: "audio-gen",
    name: "Audio Generation (ElevenLabs)",
    retries: 2,
    triggers: [{ event: "app/audio-gen.requested" }],
  },
  async ({ event, step }) => {
    const payload = event.data as AudioGenInput;

    if (!payload.text || payload.text.trim().length === 0) {
      throw new PermanentJobError("audio-gen: text is empty");
    }

    const sb = getServerSupabase();

    // Step 0 — Créer la run au démarrage
    const runId = await step.run("create-run", async () => {
      if (!sb) return null;
      return startJobRun(sb, {
        kind: "audio_gen",
        userId: payload.userId,
        tenantId: payload.tenantId,
        input: {
          assetId: payload.assetId,
          voiceId: payload.voiceId,
          modelId: payload.modelId,
          tone: payload.tone,
          textLength: payload.text?.length,
          estimatedCostUsd: payload.estimatedCostUsd,
        },
        eventId: event.id ?? "unknown",
      });
    });

    const variantId =
      (payload as AudioGenInput & { variantId?: string }).variantId ??
      (typeof payload === "object" && payload !== null && "metadata" in payload
        ? (
            payload as {
              metadata?: { variantId?: string };
            }
          ).metadata?.variantId
        : undefined);

    // Dedup — même (provider + voiceId + modelId + text) = même asset en cache
    const generationHash = computeGenerationHash({
      provider: "elevenlabs",
      text: payload.text,
      voiceId: payload.voiceId,
      modelId: payload.modelId,
      tone: payload.tone,
    });

    if (payload.tenantId) {
      const existingKey = await findDuplicateAsset(payload.tenantId, generationHash);
      if (existingKey) {
        console.info("[audio-gen/Inngest] dedup hit — skipping generation", {
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
          providerUsed: "elevenlabs",
          modelUsed: payload.modelId ?? "unknown",
          metadata: { dedup: true },
        };
      }
    }

    try {
      // Step 1 — ElevenLabs TTS + upload combinés dans un seul step.
      // Le Buffer audio ne peut pas traverser une frontière de step Inngest
      // (il serait sérialisé en JSON `{type:"Buffer",data:[...]}`).
      // On combine synthèse + upload pour garder le Buffer en mémoire.
      const { upload, ttsResult } = await step.run("synthesize-and-upload", async () => {
        let result: Awaited<ReturnType<typeof synthesizeSpeech>>;
        try {
          result = await synthesizeSpeech({
            text: payload.text,
            voiceId: payload.voiceId,
            modelId: payload.modelId,
            personaTone: payload.tone,
            idempotencyKey: `audio-${event.id}`,
          });
        } catch (err) {
          const status = (err as { status?: number }).status;
          if (status === 401 || status === 403) {
            throw new PermanentJobError("ElevenLabs auth failed", err);
          }
          if (status === 400) {
            throw new PermanentJobError("Invalid ElevenLabs request", err);
          }
          throw err;
        }

        const storage = getGlobalStorage();
        const variantKey = variantId ?? `audio-${event.id}`;
        const storageKey = `audio/${payload.assetId ?? "orphan"}/${variantKey}.mp3`;

        const uploadResult = await storage.upload(storageKey, result.audio, {
          contentType: "audio/mpeg",
          tenantId: payload.tenantId,
          metadata: {
            userId: payload.userId,
            voiceUsed: result.voiceUsed,
            modelUsed: result.modelUsed,
            chars: String(result.charCount),
          },
        });

        return {
          upload: uploadResult,
          ttsResult: {
            voiceUsed: result.voiceUsed,
            modelUsed: result.modelUsed,
            charCount: result.charCount,
            costUsd: result.costUsd,
          },
        };
      });

      // Step 2 — Update DB row asset_variants
      await step.run("update-variant", async () => {
        if (!variantId) return null;
        return await updateVariant(variantId, {
          status: "ready",
          storageUrl: upload.url,
          mimeType: "audio/mpeg",
          sizeBytes: upload.size,
          generatedAt: Date.now(),
          provider: "elevenlabs",
          // generation_hash stocké fail-soft : ignoré si colonne absente en DB
          generationHash,
          metadata: {
            voice: ttsResult.voiceUsed,
            model: ttsResult.modelUsed,
            chars: ttsResult.charCount,
          },
        });
      });

      // Step 3 — Settle credits
      await step.run("settle-credits", async () => {
        if (!payload.userId || !payload.tenantId) return null;
        return await settleCredits({
          userId: payload.userId,
          tenantId: payload.tenantId,
          reservedUsd: payload.estimatedCostUsd,
          actualUsd: ttsResult.costUsd,
          jobId: event.id ?? "unknown",
          jobKind: "audio-gen",
          description: `audio-gen via elevenlabs`,
        }).catch((err) => {
          console.error("[audio-gen/Inngest] settle_credits failed:", err);
        });
      });

      // Step 4 — Persister la run avec cost réel
      await step.run("end-run", async () => {
        if (!sb) return;
        await endJobRun(sb, {
          runId,
          status: "completed",
          costUsd: ttsResult.costUsd,
          output: {
            assetId: payload.assetId,
            variantId,
            storageUrl: upload.url,
            chars: ttsResult.charCount,
            voiceUsed: ttsResult.voiceUsed,
            modelUsed: ttsResult.modelUsed,
          },
        });
      });

      return {
        assetId: payload.assetId,
        variantId,
        storageUrl: upload.url,
        actualCostUsd: ttsResult.costUsd,
        providerUsed: "elevenlabs",
        modelUsed: ttsResult.modelUsed,
        metadata: {
          chars: ttsResult.charCount,
          voiceId: ttsResult.voiceUsed,
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
