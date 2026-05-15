/**
 * Inngest function — Weekly Slack Digest.
 *
 * Triggers :
 *  - Cron `TZ=Europe/Paris 0 17 * * 5` (vendredi 17h Paris). Le job
 *    fan-out sur tous les users avec une connexion Slack active en
 *    enqueueant un event par-user `app/weekly-digest.requested`.
 *  - Event `app/weekly-digest.requested` (déclenchement par-user, manuel
 *    ou par fan-out) → exécute l'agrégation + envoi Slack.
 *
 * Pipeline par-user :
 *  1. Vérifier la connexion Slack active.
 *  2. Agréger l'activité de la semaine (`buildWeeklyDigest`).
 *  3. Formater en Slack Block Kit (`formatWeeklyDigestBlocks`).
 *  4. Envoyer via Composio `SLACK_SEND_MESSAGE` (avec blocks JSON).
 *  5. Logger success/failure (Sentry si configuré).
 */

import { buildWeeklyDigest, type WeeklyDigestPayload } from "@/lib/cockpit/weekly-digest";
import { executeComposioAction } from "@/lib/connectors/composio/client";
import { getConnectionsByScope } from "@/lib/connectors/control-plane/store";
import { inngest } from "@/lib/jobs/inngest/client";
import { getServerSupabase } from "@/lib/platform/db/supabase";
import {
  formatWeeklyDigestBlocks,
  WEEKLY_DIGEST_DEFAULT_CHANNEL,
  WEEKLY_DIGEST_DEFAULT_TZ,
} from "@/lib/workflows/templates/weekly-slack-digest";

interface WeeklyDigestEventData {
  userId: string;
  tenantId: string;
  workspaceId?: string;
  channel?: string;
  timezone?: string;
}

interface ActiveUserScope {
  userId: string;
  tenantId: string;
  workspaceId: string;
}

const SLACK_PROVIDER = "slack";

async function reportError(scope: string, err: unknown): Promise<void> {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[WeeklyDigest/${scope}]`, msg);
  // Sentry est dispo via @sentry/nextjs — capture côté serveur si chargé.
  try {
    const Sentry = await import("@sentry/nextjs");
    Sentry.captureException(err instanceof Error ? err : new Error(msg), {
      tags: { feature: "weekly-digest", scope },
    });
  } catch {
    // Sentry non installé / non configuré — log seul.
  }
}

/**
 * Liste les users actifs ayant Slack connecté. Critère "actif" : présent
 * en table `users` avec au moins un tenant. Source de vérité minimale —
 * on évite d'élargir trop large pour éviter d'arroser la planète au
 * premier déploiement.
 */
async function loadActiveUsersWithSlack(): Promise<ActiveUserScope[]> {
  const sb = getServerSupabase();
  if (!sb) return [];

  // Récupère users + tenant principal.
  const { data: usersData, error: usersErr } = await sb.from("users").select("id, tenant_ids");
  if (usersErr || !usersData) {
    await reportError("loadActiveUsersWithSlack:users", usersErr ?? new Error("no data"));
    return [];
  }

  const candidates = (usersData as Array<{ id: string; tenant_ids: string[] | null }>)
    .filter((u) => Array.isArray(u.tenant_ids) && u.tenant_ids.length > 0)
    .map((u) => ({
      userId: u.id,
      tenantId: u.tenant_ids?.[0] ?? "",
      workspaceId: u.tenant_ids?.[0] ?? "",
    }));

  // Filtre ceux ayant Slack connecté.
  const out: ActiveUserScope[] = [];
  for (const c of candidates) {
    try {
      const conns = await getConnectionsByScope({
        tenantId: c.tenantId,
        workspaceId: c.workspaceId,
        userId: c.userId,
      });
      const hasSlack = conns.some(
        (cn) => cn.status === "connected" && cn.provider === SLACK_PROVIDER,
      );
      if (hasSlack) out.push(c);
    } catch (err) {
      await reportError("loadActiveUsersWithSlack:scope", err);
    }
  }

  return out;
}

/**
 * Cron orchestrator — vendredi 17h Paris. Fan-out un event par user actif.
 */
export const weeklyDigestCronFunction = inngest.createFunction(
  {
    id: "weekly-digest-cron",
    name: "Weekly Slack Digest — Cron Fan-out",
    retries: 1,
    triggers: [{ cron: "TZ=Europe/Paris 0 17 * * 5" }],
  },
  async ({ step }) => {
    const users = await step.run("load-active-slack-users", () => loadActiveUsersWithSlack());

    if (users.length === 0) {
      console.log("[WeeklyDigest/cron] aucun user avec Slack connecté.");
      return { dispatched: 0 };
    }

    const events = users.map((u) => ({
      name: "app/weekly-digest.requested",
      data: {
        userId: u.userId,
        tenantId: u.tenantId,
        workspaceId: u.workspaceId,
      } satisfies WeeklyDigestEventData,
    }));

    await step.sendEvent("dispatch-per-user", events);
    console.log(`[WeeklyDigest/cron] dispatched=${events.length}`);
    return { dispatched: events.length };
  },
);

/**
 * Per-user worker — exécute l'agrégation + envoi Slack pour un user.
 */
export const weeklyDigestPerUserFunction = inngest.createFunction(
  {
    id: "weekly-digest-per-user",
    name: "Weekly Slack Digest — Per User",
    retries: 2,
    concurrency: { limit: 5 },
    triggers: [{ event: "app/weekly-digest.requested" }],
  },
  async ({ event, step }) => {
    const data = event.data as WeeklyDigestEventData;

    if (!data.userId || !data.tenantId) {
      throw new Error("weekly-digest: userId/tenantId requis");
    }

    const channel = data.channel ?? WEEKLY_DIGEST_DEFAULT_CHANNEL;
    const timezone = data.timezone ?? WEEKLY_DIGEST_DEFAULT_TZ;

    // 1. Vérifier Slack toujours connecté (a pu être déconnecté entre cron + run).
    const slackConnected = await step.run("verify-slack-connected", async () => {
      try {
        const conns = await getConnectionsByScope({
          tenantId: data.tenantId,
          workspaceId: data.workspaceId ?? data.tenantId,
          userId: data.userId,
        });
        return conns.some((c) => c.status === "connected" && c.provider === SLACK_PROVIDER);
      } catch (err) {
        await reportError("verify-slack-connected", err);
        return false;
      }
    });

    if (!slackConnected) {
      console.log(`[WeeklyDigest/user=${data.userId.slice(0, 8)}] Slack déconnecté — skip.`);
      return { skipped: true, reason: "slack_disconnected" };
    }

    // 2. Agrégation.
    const payload = (await step.run("aggregate-week", () =>
      buildWeeklyDigest({
        userId: data.userId,
        tenantId: data.tenantId,
        workspaceId: data.workspaceId,
      }),
    )) as WeeklyDigestPayload;

    // 3. Format Block Kit.
    const slackPayload = formatWeeklyDigestBlocks(payload, { timezone });

    // 4. Send via Composio.
    const sendResult = await step.run("send-slack", async () => {
      try {
        const result = await executeComposioAction({
          action: "SLACK_SEND_MESSAGE",
          entityId: data.userId,
          params: {
            channel,
            text: slackPayload.text,
            // Composio Slack accepte `blocks` (JSON-encoded array). Si
            // l'API rejette le format, le `text` fallback couvre la
            // notification basique.
            blocks: JSON.stringify(slackPayload.blocks),
          },
        });

        if (!result.ok) {
          throw new Error(result.error ?? "slack send failed");
        }

        return { ok: true, channel };
      } catch (err) {
        await reportError("send-slack", err);
        throw err;
      }
    });

    console.log(
      `[WeeklyDigest/user=${data.userId.slice(0, 8)}] sent channel=${channel} window=${payload.window.label} runs=${payload.totalRuns}`,
    );

    return {
      sent: sendResult.ok,
      channel,
      window: payload.window,
      totalRuns: payload.totalRuns,
      missionsCount: payload.missionsCompleted.length,
      anomaliesCount: payload.anomalies.length,
    };
  },
);
