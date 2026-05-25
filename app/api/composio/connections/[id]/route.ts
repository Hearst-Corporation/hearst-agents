/**
 * DELETE /api/composio/connections/[id]
 *
 * Disconnects one of the authenticated user's Composio accounts.
 * The Composio SDK enforces entityId-scoped permissions server-side, so we
 * can't accidentally delete another user's connection.
 *
 * Side effect : si la connexion supportait l'inbox cron (Gmail / Slack /
 * Calendar), on désinscrit le user du repeatable BullMQ pour éviter de
 * polluer la queue avec des fetch sans credentials valides.
 */

import { NextResponse } from "next/server";
import { disconnectAccount, isComposioConfigured } from "@/lib/connectors/composio";
import { unregisterInboxRepeatable } from "@/lib/jobs/scheduled/inbox-cron";
import { redactedError, withRoute } from "@/lib/observability/logger";
import { withScope } from "@/lib/platform/http/route-handler";

const log = withRoute("DELETE /api/composio/connections/[id]");

export const DELETE = withScope<{ id: string }>(
  "DELETE /api/composio/connections/[id]",
  async (_req, { scope, params }) => {
    const { id } = params;
    const userId = scope.userId;

    if (!isComposioConfigured()) {
      return NextResponse.json({ error: "composio_not_configured" }, { status: 503 });
    }

    if (!id) {
      return NextResponse.json({ error: "missing_connection_id" }, { status: 400 });
    }

    const result = await disconnectAccount(userId, id);
    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? "disconnect_failed" }, { status: 502 });
    }

    // Désinscrit le user du cron inbox (best-effort, non-bloquant). Pas de
    // distinction par provider : `unregisterInboxRepeatable` est idempotent et
    // retire seulement le job Repeatable correspondant à ce user. Si d'autres
    // connexions inbox restent actives, le cron sera réenregistré au prochain
    // boot via `startInboxCron`. Une optimisation serait de re-vérifier ici
    // s'il reste des connexions Gmail/Slack/Calendar et seulement désinscrire
    // si plus aucune — laissé à une itération suivante.
    try {
      await unregisterInboxRepeatable({
        userId: scope.userId,
        tenantId: scope.tenantId,
        workspaceId: scope.workspaceId,
      });
    } catch (err) {
      log.warn(
        { err: redactedError(err), userId, connectionId: id },
        "unregister_inbox_repeatable_failed",
      );
    }

    return NextResponse.json({ ok: true });
  },
);
