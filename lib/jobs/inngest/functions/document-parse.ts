/**
 * Inngest function — Document Parsing (LlamaParse).
 *
 * Migration du worker BullMQ `lib/jobs/workers/document-parse.ts` vers Inngest.
 * Découpé en steps pour retry par étape.
 *
 * Trigger : event `app/document-parse.requested`
 * Idempotency : event.id = deterministicHash(payload) posé par enqueueJob()
 */

import { Buffer } from "node:buffer";
import { inngest } from "@/lib/jobs/inngest/client";
import { parseDocument } from "@/lib/capabilities/providers/llamaparse";
import { updateVariant } from "@/lib/assets/variants";
import { getGlobalStorage } from "@/lib/engine/runtime/assets/storage";
import { settleCredits } from "@/lib/credits/client";
import { PermanentJobError } from "@/lib/jobs/permanent-error";
import type { DocumentParseInput } from "@/lib/jobs/types";

export const documentParseFunction = inngest.createFunction(
  {
    id: "document-parse",
    name: "Document Parsing (LlamaParse)",
    retries: 2,
    triggers: [{ event: "app/document-parse.requested" }],
  },
  async ({ event, step }) => {
    const payload = event.data as DocumentParseInput;

    if (!payload.fileUrl) {
      throw new PermanentJobError("document-parse: fileUrl is required");
    }

    const variantId =
      (payload as DocumentParseInput & { variantId?: string }).variantId ??
      (typeof payload === "object" &&
      payload !== null &&
      "metadata" in payload
        ? (
            payload as {
              metadata?: { variantId?: string };
            }
          ).metadata?.variantId
        : undefined);

    // Step 1 — LlamaParse
    const parsed = await step.run("parse-document", async () => {
      try {
        return await parseDocument({
          fileUrl: payload.fileUrl,
          mimeType: payload.mimeType,
          idempotencyKey: `doc-${event.id}`,
        });
      } catch (err) {
        const status = (err as { status?: number }).status;
        if (status === 401 || status === 403) {
          throw new PermanentJobError("LlamaParse auth failed", err);
        }
        if (status === 400) {
          throw new PermanentJobError("Invalid LlamaParse request", err);
        }
        throw err;
      }
    });

    // Step 2 — Upload Markdown to storage
    const upload = await step.run("upload-markdown", async () => {
      const storage = getGlobalStorage();
      const variantKey = variantId ?? `doc-${event.id}`;
      const storageKey = `documents/${payload.assetId ?? "orphan"}/${variantKey}.md`;

      const mdBuffer = Buffer.from(parsed.markdown, "utf-8");
      return await storage.upload(storageKey, mdBuffer, {
        contentType: "text/markdown",
        tenantId: payload.tenantId,
        metadata: {
          userId: payload.userId,
          fileName: payload.fileName,
          pages: String(parsed.pages),
        },
      });
    });

    // Step 3 — Update DB row asset_variants
    await step.run("update-variant", async () => {
      if (!variantId) return null;
      return await updateVariant(variantId, {
        status: "ready",
        storageUrl: upload.url,
        mimeType: "text/markdown",
        sizeBytes: upload.size,
        generatedAt: Date.now(),
        provider: "llamaparse",
        metadata: {
          pages: parsed.pages,
          sourceFile: payload.fileName,
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
        actualUsd: 0,
        jobId: event.id ?? "unknown",
        jobKind: "document-parse",
        description: `document-parse via llamaparse`,
      }).catch((err) => {
        console.error("[document-parse/Inngest] settle_credits failed:", err);
      });
    });

    return {
      assetId: payload.assetId,
      variantId,
      storageUrl: upload.url,
      actualCostUsd: 0,
      providerUsed: "llamaparse",
      modelUsed: "llama-parse",
      metadata: {
        pages: parsed.pages,
        chars: parsed.markdown.length,
      },
    };
  },
);
