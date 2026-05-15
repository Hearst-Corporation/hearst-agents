/**
 * Inngest function — Pre-Meeting Intel (S3-A).
 *
 * Cron `*\/5 * * * *` (toutes les 5 minutes) : pour chaque user actif :
 *   1. Liste les events Calendar de la fenêtre 0-60min.
 *   2. Pour chaque event qui démarre dans 25-35min (fenêtre 10min pour
 *      gérer les reruns sur reboot/retry) ET qui n'est pas déjà notifié,
 *      génère le briefing via `getPreMeetingIntel` puis insère une
 *      notification `in_app_notifications` avec meta.subtype="pre_meeting".
 *   3. Marque l'event comme notifié pour éviter les doublons (table
 *      `in_app_notifications` filtrée par meta.subtype + meta.eventId).
 *
 * Dédup :
 *  - Source de vérité : presence d'une notif existante avec même eventId.
 *  - Cache mémoire 30min en complément (évite la requête Supabase à chaque tick).
 *
 * Fail-soft : chaque user est isolé via try/catch, une erreur ne casse pas
 * le tick global.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getPreMeetingIntel,
  listUpcomingEventsWithAttendees,
  type PreMeetingIntel,
} from "@/lib/cockpit/pre-meeting-intel";
import { inngest } from "@/lib/jobs/inngest/client";
import { createNotification } from "@/lib/notifications/in-app";
import { getServerSupabase } from "@/lib/platform/db/supabase";

// ── Constantes ────────────────────────────────────────────────────

/** Fenêtre cible : event qui démarre entre 25 et 35 min de maintenant. */
const TARGET_WINDOW_MIN_MS = 25 * 60_000;
const TARGET_WINDOW_MAX_MS = 35 * 60_000;

/** TTL dédup mémoire — 30min suffit puisque le tick est 5min et la fenêtre 10min. */
const DEDUP_TTL_MS = 30 * 60_000;

// In-memory dedup : `${userId}::${eventId}` → expiresAt.
const sentMemo = new Map<string, number>();

// ── Helpers ───────────────────────────────────────────────────────

interface ActiveUser {
  userId: string;
  tenantId: string;
  workspaceId: string;
}

/**
 * Liste les users avec une connexion `google` ou `gmail` active.
 * Pattern aligné sur `lib/jobs/scheduled/inbox-cron.ts:getActiveInboxUsers`.
 */
async function getActiveCalendarUsers(): Promise<ActiveUser[]> {
  const sb = getServerSupabase() as unknown as SupabaseClient | null;
  if (!sb) return [];

  const { data, error } = await sb
    .from("integration_connections")
    .select("config, provider, status")
    .in("provider", ["google", "gmail"])
    .eq("status", "connected")
    .limit(500);

  if (error || !data) return [];

  const seen = new Set<string>();
  const out: ActiveUser[] = [];
  for (const row of data as Array<{ config: unknown }>) {
    const cfg = (row.config ?? {}) as { userId?: string; tenantId?: string; workspaceId?: string };
    if (!cfg.userId || !cfg.tenantId || !cfg.workspaceId) continue;
    const key = `${cfg.userId}:${cfg.tenantId}:${cfg.workspaceId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ userId: cfg.userId, tenantId: cfg.tenantId, workspaceId: cfg.workspaceId });
  }
  return out;
}

/**
 * Vérifie en DB si une notif `pre_meeting` a déjà été créée pour ce
 * (userId, eventId). Évite les doublons en cas de redémarrage process.
 */
async function alreadyNotified(
  sb: SupabaseClient,
  tenantId: string,
  userId: string,
  eventId: string,
): Promise<boolean> {
  const { data } = await sb
    .from("in_app_notifications")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .contains("meta", { subtype: "pre_meeting", eventId })
    .limit(1)
    .maybeSingle();
  return data !== null;
}

function buildNotificationBody(intel: PreMeetingIntel): string {
  const minutesUntil = Math.round((intel.startsAt - Date.now()) / 60_000);
  const participantsLine =
    intel.participants.length > 0
      ? intel.participants
          .slice(0, 3)
          .map((p) => p.name ?? p.email)
          .join(", ")
      : "—";
  const head = `Dans ${minutesUntil}min · ${participantsLine}`;
  const tail = intel.suggestedAgenda ? ` — ${intel.suggestedAgenda}` : "";
  return (head + tail).slice(0, 500);
}

function memoKey(userId: string, eventId: string): string {
  return `${userId}::${eventId}`;
}

function cleanMemo(now: number): void {
  for (const [k, exp] of sentMemo.entries()) {
    if (exp <= now) sentMemo.delete(k);
  }
}

// ── Inngest function ──────────────────────────────────────────────

export const preMeetingIntelFunction = inngest.createFunction(
  {
    id: "pre-meeting-intel",
    name: "Pre-Meeting Intel — briefing 30min avant chaque event",
    retries: 1,
    // Cron toutes les 5 minutes — fenêtre 25-35min couvre la dispersion
    // des ticks (un event qui démarre à T+30min sera notifié au plus
    // tard à T+25min et au plus tôt à T+35min).
    triggers: [{ cron: "*/5 * * * *" }],
  },
  async ({ step }) => {
    const now = Date.now();
    cleanMemo(now);

    const users = await step.run("list-active-users", () => getActiveCalendarUsers());
    if (users.length === 0) {
      return { processed: 0, notified: 0 };
    }

    let notified = 0;

    // Process séquentiel pour ne pas saturer Composio/Supabase. Le tick
    // a 5min de budget — largement suffisant pour quelques dizaines de users.
    for (const user of users) {
      try {
        const events = await listUpcomingEventsWithAttendees(user.userId, 60);
        const targetEvents = events.filter((e) => {
          const delta = e.startsAt - now;
          return delta >= TARGET_WINDOW_MIN_MS && delta <= TARGET_WINDOW_MAX_MS;
        });

        if (targetEvents.length === 0) continue;

        const sb = getServerSupabase();
        if (!sb) continue;

        for (const ev of targetEvents) {
          const k = memoKey(user.userId, ev.id);

          // Dédup mémoire d'abord.
          if (sentMemo.has(k)) continue;

          // Dédup DB ensuite (résilient aux redémarrages).
          if (await alreadyNotified(sb, user.tenantId, user.userId, ev.id)) {
            sentMemo.set(k, now + DEDUP_TTL_MS);
            continue;
          }

          const intel = await getPreMeetingIntel(
            { userId: user.userId, tenantId: user.tenantId },
            ev.id,
          );
          if (!intel) continue;

          const created = await createNotification(sb, {
            tenantId: user.tenantId,
            userId: user.userId,
            kind: "signal",
            severity: "info",
            title: `Pre-meeting · ${intel.eventTitle}`,
            body: buildNotificationBody(intel),
            meta: {
              subtype: "pre_meeting",
              eventId: intel.eventId,
              startsAt: intel.startsAt,
              participants: intel.participants,
              suggestedAgenda: intel.suggestedAgenda,
              generatedAt: intel.generatedAt,
            },
          });

          if (created) {
            sentMemo.set(k, now + DEDUP_TTL_MS);
            notified += 1;
          }
        }
      } catch (err) {
        console.warn(`[pre-meeting-intel] échec user=${user.userId.slice(0, 8)} :`, err);
      }
    }

    console.log(`[pre-meeting-intel] tick processed=${users.length} notified=${notified}`);

    return { processed: users.length, notified };
  },
);

/** Test-only : vide le memo de dédup. */
export function __clearPreMeetingIntelMemo(): void {
  sentMemo.clear();
}
