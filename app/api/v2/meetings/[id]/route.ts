/**
 * GET /api/v2/meetings/[id]   → state polling (status + transcript + actions)
 * DELETE /api/v2/meetings/[id] → arrête le bot (leave_call) + cleanup ressource
 *
 * Le polling est utilisé par MeetingStage pendant la session — toutes les 5s
 * côté UI. On essaie d'abord `getTranscript` (segments avec speakers), puis
 * fallback `getBotStatus.transcript` si l'endpoint dédié n'est pas dispo.
 */

import { type NextRequest, NextResponse } from "next/server";
import { loadAssetById } from "@/lib/assets/types";
import { extractActionItems } from "@/lib/capabilities/providers/deepgram";
import {
  deleteBot,
  getBotStatus,
  getTranscript,
  isRecallAiConfigured,
  RecallAiUnavailableError,
  stopBot,
} from "@/lib/capabilities/providers/recall-ai";
import { logger } from "@/lib/observability/logger";
import { requireScope } from "@/lib/platform/auth/scope";
import { redactId } from "@/lib/utils/redact";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ActionItem = { action: string; owner?: string; deadline?: string };

/**
 * IDOR guard (P1-1) — vérifie que le meeting (botId Recall == asset.id,
 * persisté par POST /api/v2/meetings/start) appartient bien au scope appelant.
 *
 * Le botId est passé tel quel à Recall ; sans ce check n'importe quel user
 * authentifié pourrait lire le transcript/vidéo d'un autre tenant ou tuer
 * son bot. On charge l'asset et on exige tenantId ET userId identiques.
 *
 * Retour `false` => le caller doit répondre 404 (PAS 403 : éviter de
 * confirmer l'existence du botId — info disclosure).
 */
async function verifyMeetingOwnership(
  id: string,
  scope: { tenantId: string; userId: string },
  action: string,
): Promise<boolean> {
  const asset = await loadAssetById(id);

  const ownerMatch =
    !!asset &&
    asset.provenance.tenantId === scope.tenantId &&
    asset.provenance.userId === scope.userId;

  if (!ownerMatch) {
    logger.warn(
      {
        event: "idor_attempt",
        action,
        meetingId: id,
        userId: redactId(scope.userId),
        tenantId: redactId(scope.tenantId),
        assetFound: !!asset,
      },
      "Meeting IDOR attempt blocked",
    );
  }

  return ownerMatch;
}

async function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race<T>([p, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))]);
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const { scope, error: scopeError } = await requireScope({
    context: "GET /api/v2/meetings/[id]",
  });
  if (scopeError || !scope) {
    return NextResponse.json(
      { error: scopeError?.message ?? "not_authenticated" },
      { status: scopeError?.status ?? 401 },
    );
  }

  if (!id) {
    return NextResponse.json({ error: "meeting_id_required" }, { status: 400 });
  }

  // IDOR guard AVANT tout appel Recall — asset introuvable ou cross-tenant
  // => 404 (pas 403, anti info-disclosure).
  if (!(await verifyMeetingOwnership(id, scope, "read"))) {
    return NextResponse.json({ error: "meeting_not_found" }, { status: 404 });
  }

  if (!isRecallAiConfigured()) {
    return NextResponse.json(
      { error: "recall_ai_unavailable", message: "RECALL_API_KEY non configuré" },
      { status: 503 },
    );
  }

  try {
    const status = await getBotStatus(id);

    let transcript = status.transcript ?? "";
    let segments: Array<{ speaker: string | number; text: string; start: number; end: number }> =
      [];
    try {
      const detail = await getTranscript(id);
      if (detail.transcript) {
        transcript = detail.transcript;
      }
      segments = detail.segments;
    } catch {
      // fallback déjà géré par getTranscript pour 404 ; ignorer autres erreurs
    }

    let actionItems: ActionItem[] = [];
    if (transcript.trim().length > 0) {
      actionItems = await withTimeout(extractActionItems(transcript), 8_000, [] as ActionItem[]);
    }

    return NextResponse.json({
      meetingId: id,
      status: status.status,
      transcript,
      segments,
      actionItems,
      videoUrl: status.videoUrl,
      recordingUrl: status.videoUrl,
    });
  } catch (err) {
    if (err instanceof RecallAiUnavailableError) {
      return NextResponse.json(
        { error: "recall_ai_unavailable", message: err.message },
        { status: 503 },
      );
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "meeting_status_failed", message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const { scope, error: scopeError } = await requireScope({
    context: "DELETE /api/v2/meetings/[id]",
  });
  if (scopeError || !scope) {
    return NextResponse.json(
      { error: scopeError?.message ?? "not_authenticated" },
      { status: scopeError?.status ?? 401 },
    );
  }

  if (!id) {
    return NextResponse.json({ error: "meeting_id_required" }, { status: 400 });
  }

  // IDOR guard AVANT tout appel Recall — empêche un autre tenant/user de
  // stopper/supprimer un bot qui ne lui appartient pas. 404 anti-disclosure.
  if (!(await verifyMeetingOwnership(id, scope, "delete"))) {
    return NextResponse.json({ error: "meeting_not_found" }, { status: 404 });
  }

  if (!isRecallAiConfigured()) {
    return NextResponse.json(
      { error: "recall_ai_unavailable", message: "RECALL_API_KEY non configuré" },
      { status: 503 },
    );
  }

  try {
    await stopBot(id);
  } catch (err) {
    console.warn("[meetings/DELETE] stopBot failed:", err instanceof Error ? err.message : err);
  }

  // deleteBot fire-and-forget — pas critique si ça échoue.
  void deleteBot(id).catch(() => {});

  return NextResponse.json({ ok: true, meetingId: id, status: "stopping" });
}
