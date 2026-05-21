/**
 * Worker daily-brief (vague 9, action #2).
 *
 * Pipeline :
 *  1. Assemble les 5 sources (emails, slack, calendar, github, linear) en
 *     parallèle via `assembleDailyBriefData` — fail-soft chaque source.
 *  2. Génère la narration éditoriale 4 sections via Claude Sonnet 4.6
 *     (`generateDailyBriefNarration`).
 *  3. Render le PDF 4 pages (cover dark + manifeste + agenda + inbox/PRs/issues).
 *  4. Upload R2 via `persistExport` (réutilisation pipeline existant).
 *  5. Persiste un asset `kind: "daily_brief"` avec contentRef = JSON
 *     { storageKey, storageUrl, narration, sources }.
 *
 * Coût estimé : ~$0.05/run (Sonnet narration ~$0.04 + Haiku optionnel + storage).
 */

import { randomUUID } from "node:crypto";
import { storeAsset } from "@/lib/assets/types";
import { assembleDailyBriefData } from "@/lib/daily-brief/assembler";
import { generateDailyBriefNarration } from "@/lib/daily-brief/generate";
import { renderDailyBriefPdf } from "@/lib/daily-brief/pdf";
import type { DailyBriefAssetMeta } from "@/lib/daily-brief/types";
import type { DailyBriefInput, JobResult } from "@/lib/jobs/types";
import { startWorker, type WorkerHandler } from "@/lib/jobs/worker-base";
import { logger } from "@/lib/observability/logger";
import { getExportSignedUrl, persistExport } from "@/lib/reports/export/store";
import { redactId } from "@/lib/utils/redact";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const handler: WorkerHandler<DailyBriefInput> = {
  kind: "daily-brief",

  validateInput(payload) {
    if (!payload.userId || !payload.tenantId) {
      throw new Error("daily-brief: userId/tenantId requis");
    }
  },

  async process(ctx): Promise<JobResult> {
    const { payload, reportProgress } = ctx;
    const targetDate = payload.targetDate ?? todayIso();

    await reportProgress(10, "Assembling data sources");

    const data = await assembleDailyBriefData({
      userId: payload.userId,
      tenantId: payload.tenantId,
      targetDate,
      gmailLimit: payload.gmailLimit,
      slackLimit: payload.slackLimit,
      githubLimit: payload.githubLimit,
      linearLimit: payload.linearLimit,
    });

    await reportProgress(40, `Sources assemblées : ${data.sources.join(", ")}`);

    const narration = await generateDailyBriefNarration(data);

    await reportProgress(65, "Narration éditoriale générée");

    const pdf = await renderDailyBriefPdf({ data, narration, date: new Date(targetDate) });

    await reportProgress(80, "PDF rendu");

    const assetId = randomUUID();

    // Upload PDF + insert row report_exports (réutilise le pipeline existant)
    const persisted = await persistExport({
      result: pdf,
      format: "pdf",
      assetId,
      tenantId: payload.tenantId,
      createdBy: payload.userId,
    });

    let signedUrl: string | null = null;
    try {
      signedUrl = await getExportSignedUrl(persisted.storageKey, {
        expiresInSeconds: 24 * 3600, // 24h, le brief est consulté dans la journée
        downloadName: pdf.fileName,
      });
    } catch (err) {
      console.warn("[DailyBrief] signed URL échouée :", err);
    }

    await reportProgress(90, "PDF uploadé");

    const extrasItemCount = data.extras.reduce((acc, ex) => acc + ex.items.length, 0);
    const totalItems =
      data.emails.length +
      data.slack.length +
      data.calendar.length +
      data.github.length +
      data.linear.length +
      extrasItemCount;

    const meta: DailyBriefAssetMeta = {
      totalItems,
      sources: data.sources,
      targetDate,
      pdfUrl: signedUrl,
      storageKey: persisted.storageKey,
      pdfSizeBytes: pdf.size,
    };

    const threadId = `daily-brief:${payload.userId}`;
    const titleDate = new Date(targetDate).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    await storeAsset({
      id: assetId,
      threadId,
      kind: "daily_brief",
      title: `Daily Brief · ${titleDate}`,
      summary:
        data.sources.filter((s) => !s.endsWith(":error") && !s.endsWith(":empty")).length > 0
          ? `${totalItems} signaux · ${data.sources.filter((s) => !s.endsWith(":error") && !s.endsWith(":empty")).join(", ")}`
          : "Aucune source connectée — connecte Gmail/Slack/GitHub/Linear pour activer.",
      contentRef: JSON.stringify({
        narration,
        meta,
        // On stocke les comptes par source — pas le contenu brut (PII / size).
        counts: {
          emails: data.emails.length,
          slack: data.slack.length,
          calendar: data.calendar.length,
          github: data.github.length,
          linear: data.linear.length,
          extras: Object.fromEntries(data.extras.map((e) => [e.toolkit, e.items.length])),
        },
      }),
      createdAt: data.generatedAt,
      provenance: {
        providerId: "system",
        userId: payload.userId,
        tenantId: payload.tenantId,
        workspaceId: payload.workspaceId,
      },
    });

    await reportProgress(100, "Daily Brief prêt");

    logger.info(
      {
        userId: redactId(payload.userId),
        signals: totalItems,
        sources: data.sources,
        costUsd: narration.costUsd,
        assetId,
      },
      "[DailyBrief] complete",
    );

    return {
      assetId,
      storageUrl: persisted.storageUrl,
      actualCostUsd: narration.costUsd,
      providerUsed: "anthropic-sonnet-4-6",
      modelUsed: "claude-sonnet-4-6",
      metadata: {
        totalItems,
        sources: data.sources,
        targetDate,
        pdfSizeBytes: pdf.size,
      },
    };
  },
};

export function startDailyBriefWorker() {
  logger.info("[DailyBrief] worker started");
  return startWorker(handler);
}
