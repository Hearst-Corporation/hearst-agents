/**
 * Inngest function — Hearst Card mensuelle (Wrapped).
 *
 * Pipeline :
 *  - Cron `TZ=Europe/Paris 0 9 1 * *` (1er de chaque mois 9h Paris) → fan-out
 *    un event `app/monthly-card.requested` par user actif (avec tenant_ids).
 *  - Per-user worker → calcule la card pour le mois précédent, déclenche
 *    la génération PNG en appelant l'API interne `/api/v2/hearst-card/...`
 *    si possible (Playwright dispo), ou sinon enregistre une notification
 *    "Wrapped prêt" qui pointe vers la page HTML interne.
 *
 * Pas d'envoi externe (Slack/email) ici — on se contente de pousser une
 * notification in-app. L'utilisateur voit le badge "Wrapped prêt" dans son
 * cockpit et clique pour ouvrir la card.
 */

import { inngest } from "@/lib/jobs/inngest/client";
import {
  buildMonthlyCardData,
  previousYearMonth,
  type MonthlyCardData,
} from "@/lib/cockpit/monthly-card";
import {
  signCardToken,
  buildPublicCardUrl,
} from "@/lib/cockpit/monthly-card-token";
import { getServerSupabase } from "@/lib/platform/db/supabase";

interface MonthlyCardEventData {
  userId: string;
  tenantId: string;
  workspaceId?: string;
  /** YYYY-MM — défaut = mois précédent. */
  yearMonth?: string;
}

interface ActiveUserScope {
  userId: string;
  tenantId: string;
  workspaceId: string;
}

async function reportError(scope: string, err: unknown): Promise<void> {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[MonthlyCard/${scope}]`, msg);
  try {
    const Sentry = await import("@sentry/nextjs");
    Sentry.captureException(err instanceof Error ? err : new Error(msg), {
      tags: { feature: "monthly-card", scope },
    });
  } catch {
    /* Sentry absent */
  }
}

/**
 * Liste les users avec au moins un tenant_id renseigné.
 */
async function loadActiveUsers(): Promise<ActiveUserScope[]> {
  const sb = getServerSupabase();
  if (!sb) return [];

  const { data, error } = await sb.from("users").select("id, tenant_ids");
  if (error || !data) {
    await reportError("loadActiveUsers", error ?? new Error("no data"));
    return [];
  }

  return (data as Array<{ id: string; tenant_ids: string[] | null }>)
    .filter((u) => Array.isArray(u.tenant_ids) && u.tenant_ids.length > 0)
    .map((u) => ({
      userId: u.id,
      tenantId: u.tenant_ids?.[0] ?? "",
      workspaceId: u.tenant_ids?.[0] ?? "",
    }));
}

/**
 * Tente de pousser une notification in-app. Best-effort : si la table
 * `notifications` n'existe pas ou échoue, on log et on continue.
 */
async function pushReadyNotification(
  scope: ActiveUserScope,
  data: MonthlyCardData,
  shareUrl: string,
): Promise<void> {
  const sb = getServerSupabase();
  if (!sb) return;

  try {
    // La table `notifications` n'est pas typée dans `database.types.ts` —
    // on bypass le type checker pour ne pas bloquer le build, l'insertion
    // reste protégée par un try/catch + best-effort.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sbAny = sb as unknown as { from: (table: string) => any };
    const { error } = await sbAny.from("notifications").insert({
      user_id: scope.userId,
      tenant_id: scope.tenantId,
      kind: "hearst_card_ready",
      title: `Votre Wrapped ${data.window.label} est prêt`,
      body: `${data.missionsRun} missions, ${data.reportsGenerated} rapports — partagez votre carte.`,
      cta_href: shareUrl,
      created_at: new Date().toISOString(),
    });
    if (error) {
      console.warn("[MonthlyCard/notify] insert error:", error.message);
    }
  } catch (err) {
    await reportError("pushReadyNotification", err);
  }
}

/**
 * Cron orchestrator — 1er de chaque mois 9h Paris. Fan-out per-user.
 */
export const monthlyCardCronFunction = inngest.createFunction(
  {
    id: "monthly-card-cron",
    name: "Hearst Card Mensuelle — Cron Fan-out",
    retries: 1,
    triggers: [{ cron: "TZ=Europe/Paris 0 9 1 * *" }],
  },
  async ({ step }) => {
    const users = await step.run("load-active-users", () => loadActiveUsers());

    if (users.length === 0) {
      console.log("[MonthlyCard/cron] aucun user actif.");
      return { dispatched: 0 };
    }

    const yearMonth = previousYearMonth();

    const events = users.map((u) => ({
      name: "app/monthly-card.requested",
      data: {
        userId: u.userId,
        tenantId: u.tenantId,
        workspaceId: u.workspaceId,
        yearMonth,
      } satisfies MonthlyCardEventData,
    }));

    await step.sendEvent("dispatch-per-user", events);
    console.log(`[MonthlyCard/cron] dispatched=${events.length} ym=${yearMonth}`);
    return { dispatched: events.length, yearMonth };
  },
);

/**
 * Per-user worker — agrège + signe le token public + notifie.
 *
 * Note : on ne déclenche PAS la génération PNG ici (Playwright requiert
 * un binaire chromium qui n'est pas disponible dans l'environnement
 * Inngest serverless). Le PNG sera généré à la demande quand l'user
 * clique sur "Voir mon Wrapped" → POST /api/v2/hearst-card/[ym].
 */
export const monthlyCardPerUserFunction = inngest.createFunction(
  {
    id: "monthly-card-per-user",
    name: "Hearst Card Mensuelle — Per User",
    retries: 2,
    concurrency: { limit: 5 },
    triggers: [{ event: "app/monthly-card.requested" }],
  },
  async ({ event, step }) => {
    const data = event.data as MonthlyCardEventData;

    if (!data.userId || !data.tenantId) {
      throw new Error("monthly-card: userId/tenantId requis");
    }
    const yearMonth = data.yearMonth ?? previousYearMonth();

    // 1. Agrégation.
    const cardData = (await step.run("aggregate-month", () =>
      buildMonthlyCardData(
        {
          userId: data.userId,
          tenantId: data.tenantId,
          workspaceId: data.workspaceId,
        },
        yearMonth,
        { bypassCache: true },
      ),
    )) as MonthlyCardData;

    // 2. Sign token public (1 an).
    const signed = signCardToken({
      userId: data.userId,
      yearMonth,
      mode: "public",
    });
    if (!signed) {
      console.warn(
        `[MonthlyCard/user=${data.userId.slice(0, 8)}] sharing secret manquant — notification skip.`,
      );
      return { skipped: true, reason: "no_secret" };
    }
    const shareUrl = buildPublicCardUrl(signed.token);

    // 3. Notif in-app.
    await step.run("push-notification", () =>
      pushReadyNotification(
        {
          userId: data.userId,
          tenantId: data.tenantId,
          workspaceId: data.workspaceId ?? data.tenantId,
        },
        cardData,
        shareUrl,
      ),
    );

    console.log(
      `[MonthlyCard/user=${data.userId.slice(0, 8)}] ready ym=${yearMonth} runs=${cardData.missionsRun} reports=${cardData.reportsGenerated}`,
    );

    return {
      userId: data.userId,
      yearMonth,
      shareUrl,
      missionsRun: cardData.missionsRun,
      reportsGenerated: cardData.reportsGenerated,
      anomaliesCount: cardData.anomaliesCount,
    };
  },
);
