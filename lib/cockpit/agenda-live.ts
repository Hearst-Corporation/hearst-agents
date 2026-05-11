/**
 * Agenda live — Google Calendar.
 *
 * Stratégie en cascade :
 *   1. Composio `GOOGLECALENDAR_LIST_EVENTS` si l'user a fait OAuth Composio.
 *   2. Fallback natif : `getUpcomingEvents` qui lit le SSO Google NextAuth.
 *
 * Format normalisé en CockpitAgendaItem. Cache 5min.
 */

import { executeComposioAction } from "@/lib/connectors/composio/client";
import { getUpcomingEvents } from "@/lib/connectors/google/calendar";
import type { CockpitAgendaItem } from "./types";

interface CacheEntry {
  items: CockpitAgendaItem[];
  expiresAt: number;
}

const CACHE_TTL_MS = 5 * 60_000;
const cache = new Map<string, CacheEntry>();

function key(scope: { userId: string; tenantId: string }): string {
  return `${scope.tenantId}::${scope.userId}`;
}

interface GcalEvent {
  id?: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: Array<{ email?: string; responseStatus?: string }>;
  location?: string;
  hangoutLink?: string;
}

function unwrapEvents(raw: unknown): GcalEvent[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as GcalEvent[];
  const obj = raw as { items?: unknown; data?: unknown; events?: unknown; response_data?: unknown };
  if (Array.isArray(obj.items)) return obj.items as GcalEvent[];
  if (Array.isArray(obj.data)) return obj.data as GcalEvent[];
  if (Array.isArray(obj.events)) return obj.events as GcalEvent[];
  if (obj.response_data) return unwrapEvents(obj.response_data);
  return [];
}

function eventStart(ev: GcalEvent): number | null {
  const s = ev.start?.dateTime ?? ev.start?.date;
  if (!s) return null;
  const t = new Date(s).getTime();
  return Number.isFinite(t) ? t : null;
}

export async function getLiveAgenda(scope: {
  userId: string;
  tenantId: string;
}): Promise<CockpitAgendaItem[]> {
  const k = key(scope);
  const cached = cache.get(k);
  if (cached && cached.expiresAt > Date.now()) return cached.items;

  // Window : maintenant → demain 12h.
  const now = new Date();
  const tomorrowNoon = new Date(now);
  tomorrowNoon.setDate(tomorrowNoon.getDate() + 1);
  tomorrowNoon.setHours(12, 0, 0, 0);

  const res = await executeComposioAction({
    action: "GOOGLECALENDAR_LIST_EVENTS",
    entityId: scope.userId,
    params: {
      calendar_id: "primary",
      time_min: now.toISOString(),
      time_max: tomorrowNoon.toISOString(),
      single_events: true,
      order_by: "startTime",
      max_results: 20,
    },
  });

  if (!res.ok) {
    // Fallback : SSO Google natif (NextAuth tokens). Si l'user n'a pas fait
    // OAuth Composio mais s'est loggé via Google, on lit son calendrier
    // directement via googleapis avec le refresh token NextAuth.
    try {
      const native = await getUpcomingEvents(scope.userId, 1, 20);
      const items: CockpitAgendaItem[] = [];
      for (const ev of native) {
        const ts = new Date(ev.startTime).getTime();
        if (!Number.isFinite(ts)) continue;
        items.push({
          id: ev.id || `gcal_native_${ts}`,
          title: ev.title,
          startsAt: ts,
          source: "live",
        });
      }
      items.sort((a, b) => a.startsAt - b.startsAt);
      cache.set(k, { items, expiresAt: Date.now() + CACHE_TTL_MS });
      return items;
    } catch {
      cache.set(k, { items: [], expiresAt: Date.now() + CACHE_TTL_MS });
      return [];
    }
  }

  const events = unwrapEvents(res.data)
    .map((ev) => ({ ev, startsAt: eventStart(ev) }))
    .filter((x): x is { ev: GcalEvent; startsAt: number } => x.startsAt !== null)
    .sort((a, b) => a.startsAt - b.startsAt);

  const items: CockpitAgendaItem[] = events.map((x, i) => ({
    id: x.ev.id ?? `gcal_${i}`,
    title: x.ev.summary ?? "(sans titre)",
    startsAt: x.startsAt,
    source: "live",
  }));

  cache.set(k, { items, expiresAt: Date.now() + CACHE_TTL_MS });
  return items;
}
