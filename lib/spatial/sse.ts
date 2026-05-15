/**
 * Helpers SSE pour le module spatial.
 *
 * Reproduit le pattern de parsing utilisé par `app/(user)/components/ChatDock.tsx`
 * (lignes 156-297). Extrait ici pour éviter la duplication entre ChatDock et la
 * CommandBar spatial. Le parsing reconnaît à la fois les flux "data:"-only
 * (utilisés par /api/orchestrate) et les flux "event: + data:" (utilisés par
 * d'autres endpoints).
 */

export interface SSEEvent {
  type: string;
  [key: string]: unknown;
}

/**
 * Parse un buffer SSE complet et extrait tous les events terminés.
 * Retourne le buffer résiduel (incomplete) à concaténer avec le prochain chunk.
 */
export function parseSSEChunk(buffer: string): { events: SSEEvent[]; rest: string } {
  const lines = buffer.split("\n");
  const rest = lines.pop() ?? "";
  const events: SSEEvent[] = [];

  let pendingEventType: string | null = null;

  for (const line of lines) {
    if (line.startsWith("event:")) {
      pendingEventType = line.slice(6).trim();
      continue;
    }
    if (line.startsWith("data:")) {
      try {
        const data = JSON.parse(line.slice(5).trim());
        if (pendingEventType && !data.type) {
          events.push({ type: pendingEventType, ...data });
        } else {
          events.push(data);
        }
      } catch {
        /* malformed line — skip silently like ChatDock does */
      }
      pendingEventType = null;
    }
  }

  return { events, rest };
}
