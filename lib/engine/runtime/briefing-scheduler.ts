import { randomUUID } from "node:crypto";
import { type Asset, storeAsset } from "@/lib/assets/types";
import { createVariant } from "@/lib/assets/variants";
import { enqueueJob } from "@/lib/jobs/queue";
import type { AudioGenInput } from "@/lib/jobs/types";
import { generateBriefing } from "@/lib/memory/briefing";
import { getRedis, redisSetNxEx } from "@/lib/platform/redis/client";

const BRIEFING_TTL_SECS = 24 * 60 * 60;

function briefingKey(userId: string): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return `briefing:sent:${userId}:${ymd}`;
}

export function getTodayBriefingKey(userId: string): string {
  return briefingKey(userId);
}

export async function scheduleDailyBriefing(params: {
  userId: string;
  tenantId: string;
  workspaceId: string;
}): Promise<void> {
  const { userId, tenantId, workspaceId } = params;
  const redis = getRedis();
  const key = briefingKey(userId);
  const assetId = randomUUID();

  // SET NX EX atomique : pose le verrou AVANT de générer le briefing pour
  // empêcher deux appels concurrents de produire chacun un brief + audio.
  // L'ancien pattern `get` puis `set` à la fin laissait une fenêtre de
  // race condition (cf. audit P0-8). On stocke assetId comme valeur dès
  // maintenant ; si Redis est down, on continue best-effort sans dédup.
  if (redis) {
    const acquired = await redisSetNxEx(redis, key, assetId, BRIEFING_TTL_SECS).catch(() => false);
    if (!acquired) return;
  }

  const briefing = await generateBriefing({ userId });
  const asset: Asset = {
    id: assetId,
    threadId: `briefing:${userId}`,
    kind: "brief",
    title: `Briefing matinal — ${new Date().toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })}`,
    summary: briefing.text,
    provenance: {
      providerId: "system",
      tenantId,
      workspaceId,
      userId,
      runArtifact: true,
    },
    createdAt: Date.now(),
  };
  storeAsset(asset);

  if (briefing.audioScript.trim().length > 0) {
    const variantId = await createVariant({
      assetId,
      kind: "audio",
      status: "pending",
      provider: "elevenlabs",
    });

    if (variantId) {
      const payload: AudioGenInput & { variantId: string } = {
        jobKind: "audio-gen",
        userId,
        tenantId,
        workspaceId,
        assetId,
        estimatedCostUsd: 0.01,
        text: briefing.audioScript,
        variantKind: "audio",
        variantId,
      };

      await enqueueJob(payload).catch((err) => {
        console.warn("[briefing-scheduler] enqueue échoué (Redis indisponible):", err);
      });
    }
  }
  // Note : le verrou Redis a déjà été posé en début de fonction via SET NX EX.
  // Pas besoin de SET final ici — l'idempotency est déjà garantie.
}
