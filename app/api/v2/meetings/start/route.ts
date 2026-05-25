/**
 * POST /api/v2/meetings/start — déclenche le bot Recall.ai sur une réunion.
 *
 * Pattern : crée le bot synchrone (Recall répond < 1s), persiste un asset
 * placeholder `kind: "event"` qui matérialise la session côté UI, puis
 * enqueue le worker meeting-bot pour le polling + transcription finale.
 *
 * Sans `RECALL_API_KEY`, on retourne 503 propre — le MeetingStage affiche
 * un CTA "Configure Recall.ai dans .env".
 */

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { storeAsset } from "@/lib/assets/types";
import {
  createMeetingBot,
  detectMeetingProvider,
  isRecallAiConfigured,
  RecallAiUnavailableError,
  validateMeetingUrl,
} from "@/lib/capabilities/providers/recall-ai";
import { enqueueJob } from "@/lib/jobs/queue";
import type { MeetingBotInput } from "@/lib/jobs/types";
import { requireScope } from "@/lib/platform/auth/scope";
import { parseJsonBody } from "@/lib/platform/http/parse-body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const meetingsStartBodySchema = z
  .object({
    meetingUrl: z.string().max(2048).optional(),
    joinUrl: z.string().max(2048).optional(),
    threadId: z.string().max(200).optional(),
    language: z.string().max(10).optional(),
    botName: z.string().max(200).optional(),
  })
  .strict();

type StartBody = z.infer<typeof meetingsStartBodySchema>;

export async function POST(req: NextRequest) {
  const { scope, error: scopeError } = await requireScope({
    context: "POST /api/v2/meetings/start",
  });
  if (scopeError || !scope) {
    return NextResponse.json(
      { error: scopeError?.message ?? "not_authenticated" },
      { status: scopeError?.status ?? 401 },
    );
  }

  if (!isRecallAiConfigured()) {
    return NextResponse.json(
      {
        error: "recall_ai_unavailable",
        message: "RECALL_API_KEY non configuré",
      },
      { status: 503 },
    );
  }

  const parsedMeeting = await parseJsonBody(req, meetingsStartBodySchema);
  if (!parsedMeeting.ok) return parsedMeeting.response;
  const body: StartBody = parsedMeeting.data;

  const meetingUrl = (body.meetingUrl ?? body.joinUrl ?? "").trim();
  const validation = validateMeetingUrl(meetingUrl);
  if (!validation.ok) {
    return NextResponse.json(
      { error: "invalid_meeting_url", reason: validation.reason },
      { status: 400 },
    );
  }

  const language = body.language?.trim() || "fr";
  const provider = detectMeetingProvider(meetingUrl);

  let botResult: { botId: string; status: string } | null = null;
  try {
    botResult = await createMeetingBot({
      meetingUrl,
      botName: body.botName,
      language,
    });
  } catch (err) {
    if (err instanceof RecallAiUnavailableError) {
      return NextResponse.json(
        { error: "recall_ai_unavailable", message: err.message },
        { status: 503 },
      );
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "meeting_bot_create_failed", message }, { status: 502 });
  }

  const meetingId = botResult.botId;
  const threadId = body.threadId?.trim() || `meeting:${meetingId}`;
  const startedAt = Date.now();

  // Asset placeholder : `event` est sémantiquement le kind le plus proche
  // d'un meeting et n'introduit pas de migration. Les détails (transcript,
  // action items, recording URL) seront fusionnés dans `provenance` par le
  // worker à la fin.
  await storeAsset({
    id: meetingId,
    threadId,
    kind: "event",
    title: `Meeting · ${provider} · ${new Date(startedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" })}`,
    summary: "Réunion en cours",
    createdAt: startedAt,
    provenance: {
      providerId: "system",
      tenantId: scope.tenantId,
      workspaceId: scope.workspaceId,
      userId: scope.userId,
      channelRef: meetingUrl,
    },
    contentRef: JSON.stringify({
      meetingProvider: provider,
      botId: meetingId,
      joinUrl: meetingUrl,
      language,
      status: botResult.status,
      transcript: "",
      actionItems: [],
      startedAt,
    }),
  });

  // Enqueue worker — fail-soft : si Redis manque, on retourne quand même
  // le meetingId, l'UI continuera à poller getBotStatus() directement.
  let jobId: string | null = null;
  try {
    const jobPayload: MeetingBotInput = {
      jobKind: "meeting-bot",
      meetingUrl,
      meetingProvider: provider === "unknown" ? "zoom" : provider,
      recordingPolicy: "all_participants_consent",
      userId: scope.userId,
      tenantId: scope.tenantId,
      workspaceId: scope.workspaceId,
      assetId: meetingId,
      estimatedCostUsd: 0,
    };
    const enq = await enqueueJob(jobPayload);
    jobId = enq.jobId;
  } catch (err) {
    console.warn(
      "[meetings/start] enqueueJob failed (Redis indisponible ?) — l'UI fallback poll Recall directement:",
      err instanceof Error ? err.message : err,
    );
  }

  return NextResponse.json(
    {
      meetingId,
      jobId,
      status: botResult.status,
      provider,
      threadId,
    },
    { status: 202 },
  );
}
