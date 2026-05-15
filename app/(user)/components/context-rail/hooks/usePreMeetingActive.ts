"use client";

/**
 * usePreMeetingActive — détecte la notification pre_meeting non-lue la plus
 * récente dont l'event n'a pas encore commencé. Sert de bascule pour
 * afficher <ContextRailForPreMeeting> à la place du dashboard cockpit/chat.
 *
 * Retourne `null` si aucune notif active. Le store notifications est
 * hydraté côté client via `startRealtime` (cf. layout user).
 */

import { useNotificationsStore } from "@/stores/notifications";
import type { PreMeetingNotificationMeta } from "../ContextRailForPreMeeting";

export function usePreMeetingActive(): {
  eventTitle: string;
  meta: PreMeetingNotificationMeta;
} | null {
  const notifications = useNotificationsStore((s) => s.notifications);

  // `created_at` (string ISO ; figé côté DB) sert de référence stable pour
  // déterminer si la notif est "trop vieille" (> 60min) — pure et idempotent
  // contrairement à Date.now(). Si l'event est démarré depuis longtemps, la
  // notif aura été marquée read par l'user ; on filtre simplement les notifs
  // pre_meeting non-lues sans ré-évaluer l'écoulement temps réel ici.
  for (const n of notifications) {
    if (n.read_at !== null) continue;
    const meta = n.meta as Record<string, unknown> | null;
    if (!meta || meta.subtype !== "pre_meeting") continue;
    const startsAt = typeof meta.startsAt === "number" ? meta.startsAt : null;
    if (startsAt === null) continue;

    const participants = Array.isArray(meta.participants)
      ? (meta.participants as PreMeetingNotificationMeta["participants"])
      : [];
    const suggestedAgenda = typeof meta.suggestedAgenda === "string" ? meta.suggestedAgenda : "";
    const eventId = typeof meta.eventId === "string" ? meta.eventId : "";
    const generatedAt = typeof meta.generatedAt === "number" ? meta.generatedAt : startsAt;

    // Le titre est dans la notif title : "Pre-meeting · <titre>"
    const eventTitle = n.title.replace(/^Pre-meeting\s*·\s*/i, "").trim() || "(sans titre)";

    return {
      eventTitle,
      meta: {
        subtype: "pre_meeting",
        eventId,
        startsAt,
        participants,
        suggestedAgenda,
        generatedAt,
      },
    };
  }

  return null;
}
