/**
 * Public Approval Vote — POST endpoint.
 *
 * Endpoint public (pas d'auth NextAuth) — l'authentification est portée
 * par la signature HMAC du token dans l'URL. Appelé depuis la page
 * /public/approvals/[token] quand l'approbateur clique "Approuver" /
 * "Rejeter".
 *
 * Si la session bascule en "approved" → trigger l'exécution mission via
 * fetch interne vers /api/v2/missions/[id]/run (best-effort, fire-and-forget).
 */

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getApprovalState, recordVote } from "@/lib/missions/approvals";

export const dynamic = "force-dynamic";

const voteBodySchema = z.object({
  vote: z.enum(["approved", "rejected"]),
  comment: z.string().max(1000).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let body: { vote: "approved" | "rejected"; comment?: string };
  try {
    const json = await req.json();
    body = voteBodySchema.parse(json);
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const result = await recordVote(token, body.vote, body.comment);
  if (!result.ok) {
    const code = result.reason ?? "unknown";
    const status =
      code === "expired" || code === "bad_signature" || code === "no_secret"
        ? 401
        : code === "not_found"
          ? 404
          : code === "already_voted" || code === "session_rejected"
            ? 409
            : code === "malformed"
              ? 400
              : 500;
    return NextResponse.json({ ok: false, error: code }, { status });
  }

  // Trigger mission run si la session bascule en approved
  if (result.sessionApproved && result.missionId) {
    void triggerMissionRun(result.missionId).catch((err) => {
      console.warn(`[approvals/vote] runMissionNow failed for ${result.missionId}:`, err);
    });
  }

  return NextResponse.json({
    ok: true,
    state: result.state,
    sessionApproved: result.sessionApproved,
    sessionRejected: result.sessionRejected,
  });
}

/**
 * GET — renvoie l'état public de la session pour la page de vote
 * (read-only, contexte mission sans exposer la liste complète des emails).
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { verifyApprovalToken, getApprovalByTokenHash } = await import("@/lib/missions/approvals");

  const v = verifyApprovalToken(token);
  if (!v.ok) {
    return NextResponse.json({ ok: false, error: v.reason }, { status: 401 });
  }

  const row = await getApprovalByTokenHash(v.tokenHash);
  if (!row) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const state = await getApprovalState(row.mission_id);
  return NextResponse.json({
    ok: true,
    approvalId: row.id,
    missionId: row.mission_id,
    approverEmail: row.approver_email,
    vote: row.vote,
    expiresAt: row.expires_at,
    state,
  });
}

/**
 * Déclenche le run de la mission. On utilise un fetch interne vers
 * /api/v2/missions/[id]/run au lieu d'importer orchestrate directement
 * pour rester aligné sur le path canonique (auth scope, mission memory,
 * webhooks, etc.). Best-effort : si le fetch échoue, on logge.
 *
 * NB : l'endpoint /run nécessite un scope authentifié. Pour le run
 * post-approbation, on bypass via un header signé interne. Implémentation
 * minimale : on appelle directement le scheduler en read-only puis on
 * marque la mission pour run au prochain tick (lastRunStatus reset).
 *
 * Plus simple et robuste : on enqueue un signal côté ops-store que le
 * scheduler picke au prochain tick — mais cela introduit un délai jusqu'à
 * 60s. Pour Q3-D MVP, on laisse le caller (cockpit) déclencher le run via
 * /run après réception du webhook approval.completed. Ici on se contente
 * de logger et de laisser le hasActiveApprovalSession() retomber à false
 * au prochain tick scheduler, qui exécutera alors la mission.
 */
async function triggerMissionRun(missionId: string): Promise<void> {
  // Le scheduler verra hasActiveApprovalSession === false (tous les votes
  // sont posés et plus aucun "pending") et lancera la mission au prochain
  // tick. On peut aussi forcer un run immédiat via une route signée si
  // le délai jusqu'à 60s est inacceptable — non implémenté pour MVP.
  console.log(
    `[approvals/vote] Mission ${missionId} approuvée — exécution au prochain tick scheduler`,
  );
}
