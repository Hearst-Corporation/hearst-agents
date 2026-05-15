/**
 * Pre-Meeting Intel — briefing pré-meeting (S3-A).
 *
 * Pour chaque event Calendar qui démarre dans 25-35min :
 *  1. Récupère l'event (Composio LIST_EVENTS sur fenêtre 0-60min, ou SSO Google natif).
 *  2. Pour chaque participant (email) : cherche dans le KG les entités/relations
 *     liées au label correspondant (par email exact ou label contenant l'email),
 *     et compose un kgSummary court.
 *  3. Génère une suggestion d'agenda via Claude Haiku (≤200 chars, FR, 3 bullets).
 *
 * Sortie structurée `PreMeetingIntel`. Cache 5min côté serveur par
 * (userId, eventId) — la fenêtre Inngest est de 5min donc on évite de
 * recompacter le KG/Haiku à chaque tick.
 *
 * Fail-soft : aucune branche n'interrompt la chaîne, le pire renvoie un
 * payload partiel (`participants: []`, `suggestedAgenda: ""`).
 */

import Anthropic from "@anthropic-ai/sdk";
import { executeComposioAction } from "@/lib/connectors/composio/client";
import { getUpcomingEvents } from "@/lib/connectors/google/calendar";
import type { KgNode } from "@/lib/memory/kg";
import { requireServerSupabase } from "@/lib/platform/db/supabase";

// ── Types publics ────────────────────────────────────────────────

export interface PreMeetingParticipant {
  /** Email RFC 5322 (lowercased). */
  email: string;
  /** Nom d'affichage si disponible (depuis Google attendees). */
  name: string | null;
  /** Résumé KG compact : entité + 1-2 relations clés (≤120 chars). null si rien. */
  kgSummary: string | null;
  /** Dernier échange/thread KG lié à ce participant (ISO date + label). */
  lastInteraction: { label: string; at: string } | null;
}

export interface PreMeetingIntel {
  eventId: string;
  eventTitle: string;
  /** Timestamp UNIX ms du début. */
  startsAt: number;
  participants: PreMeetingParticipant[];
  /** Suggestion d'agenda générée par Haiku, ≤200 chars, en français. */
  suggestedAgenda: string;
  /** Timestamp ms de génération. */
  generatedAt: number;
}

// ── Cache 5min ───────────────────────────────────────────────────

interface CacheEntry {
  intel: PreMeetingIntel;
  expiresAt: number;
}

const CACHE_TTL_MS = 5 * 60_000;
const cache = new Map<string, CacheEntry>();

function cacheKey(userId: string, eventId: string): string {
  return `${userId}::${eventId}`;
}

// ── Fetch event Calendar ─────────────────────────────────────────

interface RawAttendee {
  email: string;
  name: string | null;
}

interface RawEvent {
  id: string;
  title: string;
  startsAt: number;
  attendees: RawAttendee[];
}

interface GcalAttendee {
  email?: string;
  displayName?: string;
  responseStatus?: string;
  organizer?: boolean;
  self?: boolean;
}

interface GcalEvent {
  id?: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  attendees?: GcalAttendee[];
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

/**
 * Liste les events Calendar de la fenêtre [now, now+windowMin] avec
 * attendees normalisés. Cascade Composio → SSO natif.
 *
 * Réutilisable par le job Inngest pour balayer les events 25-35min.
 */
export async function listUpcomingEventsWithAttendees(
  userId: string,
  windowMin = 60,
): Promise<RawEvent[]> {
  const now = Date.now();
  const timeMin = new Date(now).toISOString();
  const timeMax = new Date(now + windowMin * 60_000).toISOString();

  // 1) Composio path (avec attendees inclus dans la réponse).
  try {
    const res = await executeComposioAction({
      action: "GOOGLECALENDAR_LIST_EVENTS",
      entityId: userId,
      params: {
        calendar_id: "primary",
        time_min: timeMin,
        time_max: timeMax,
        single_events: true,
        order_by: "startTime",
        max_results: 30,
      },
    });
    if (res.ok) {
      const events = unwrapEvents(res.data);
      const out: RawEvent[] = [];
      for (const ev of events) {
        const startIso = ev.start?.dateTime ?? ev.start?.date;
        if (!startIso) continue;
        const ts = new Date(startIso).getTime();
        if (!Number.isFinite(ts)) continue;
        out.push({
          id: ev.id ?? `gcal_${ts}`,
          title: ev.summary ?? "(sans titre)",
          startsAt: ts,
          attendees: (ev.attendees ?? [])
            .filter((a) => typeof a.email === "string" && a.email.includes("@") && !a.self)
            .map((a) => ({
              email: (a.email ?? "").toLowerCase().trim(),
              name: a.displayName?.trim() ?? null,
            })),
        });
      }
      return out;
    }
  } catch (err) {
    console.warn("[pre-meeting-intel] Composio LIST_EVENTS échoué :", err);
  }

  // 2) Fallback SSO Google natif. Note : `getUpcomingEvents` retourne
  //    `attendees: string[]` (displayName ou email) — on tente d'extraire
  //    les emails par regex, et on met `name` à null car la structure ne
  //    sépare pas les deux.
  try {
    const native = await getUpcomingEvents(userId, 1, 30);
    const out: RawEvent[] = [];
    for (const ev of native) {
      const ts = new Date(ev.startTime).getTime();
      if (!Number.isFinite(ts)) continue;
      if (ts < now || ts > now + windowMin * 60_000) continue;
      const attendees: RawAttendee[] = [];
      for (const raw of ev.attendees ?? []) {
        const emailMatch = raw.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
        if (!emailMatch) continue;
        const email = emailMatch[0].toLowerCase();
        const name = raw.replace(emailMatch[0], "").replace(/[<>]/g, "").trim() || null;
        attendees.push({ email, name });
      }
      out.push({
        id: ev.id || `gcal_native_${ts}`,
        title: ev.title,
        startsAt: ts,
        attendees,
      });
    }
    return out;
  } catch (err) {
    console.warn("[pre-meeting-intel] SSO natif échoué :", err);
    return [];
  }
}

// ── KG lookup par participant ────────────────────────────────────

interface KgEdgeLite {
  source_id: string;
  target_id: string;
  type: string;
  created_at: string;
}

/**
 * Cherche dans `kg_nodes` un node "person" dont les properties contiennent
 * cet email OU dont le label contient l'email. Retourne le premier match.
 * Scope user_id + tenant_id stricts (RLS-ready).
 */
async function findPersonNodeByEmail(
  userId: string,
  tenantId: string,
  email: string,
): Promise<KgNode | null> {
  const sb = requireServerSupabase();
  const safe = email.replace(/[%_]/g, "\\$&");

  // 1) Properties contains email — supabase JSON containment.
  const { data: byProps } = await sb
    .from("kg_nodes")
    .select("*")
    .eq("user_id", userId)
    .eq("tenant_id", tenantId)
    .eq("type", "person")
    .contains("properties", { email })
    .limit(1)
    .maybeSingle();
  if (byProps) return byProps as KgNode;

  // 2) Label contains email (fallback : person seedée à partir du from-header).
  const { data: byLabel } = await sb
    .from("kg_nodes")
    .select("*")
    .eq("user_id", userId)
    .eq("tenant_id", tenantId)
    .eq("type", "person")
    .ilike("label", `%${safe}%`)
    .limit(1)
    .maybeSingle();
  if (byLabel) return byLabel as KgNode;

  return null;
}

/** Récupère 3 dernières interactions (edges) pour un node, avec node "autre" résolu. */
async function getLastInteractions(
  userId: string,
  tenantId: string,
  nodeId: string,
): Promise<Array<{ label: string; at: string }>> {
  const sb = requireServerSupabase();

  const [{ data: outEdges }, { data: inEdges }] = await Promise.all([
    sb
      .from("kg_edges")
      .select("source_id, target_id, type, created_at")
      .eq("user_id", userId)
      .eq("tenant_id", tenantId)
      .eq("source_id", nodeId)
      .order("created_at", { ascending: false })
      .limit(5),
    sb
      .from("kg_edges")
      .select("source_id, target_id, type, created_at")
      .eq("user_id", userId)
      .eq("tenant_id", tenantId)
      .eq("target_id", nodeId)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const allEdges = [...((outEdges ?? []) as KgEdgeLite[]), ...((inEdges ?? []) as KgEdgeLite[])]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 3);

  if (allEdges.length === 0) return [];

  const otherIds = Array.from(
    new Set(allEdges.map((e) => (e.source_id === nodeId ? e.target_id : e.source_id))),
  );
  const { data: otherNodes } = await sb
    .from("kg_nodes")
    .select("id, label")
    .eq("user_id", userId)
    .eq("tenant_id", tenantId)
    .in("id", otherIds);

  const labelById = new Map((otherNodes ?? []).map((n) => [n.id as string, n.label as string]));

  return allEdges
    .map((e) => {
      const otherId = e.source_id === nodeId ? e.target_id : e.source_id;
      const label = labelById.get(otherId);
      if (!label) return null;
      return { label: `${e.type} → ${label}`, at: e.created_at };
    })
    .filter((x): x is { label: string; at: string } => x !== null);
}

function buildKgSummary(node: KgNode | null, lastN: Array<{ label: string }>): string | null {
  if (!node) return null;
  const props = (node.properties ?? {}) as Record<string, unknown>;
  const role = typeof props.role === "string" ? props.role.trim().slice(0, 40) : null;
  const company = typeof props.company === "string" ? props.company.trim().slice(0, 40) : null;
  const headParts: string[] = [];
  if (role) headParts.push(role);
  if (company) headParts.push(company);
  const head = headParts.length > 0 ? headParts.join(" · ") : node.label;
  const tail = lastN
    .slice(0, 2)
    .map((l) => l.label)
    .join(", ");
  const out = tail ? `${head} — ${tail}` : head;
  return out.slice(0, 120);
}

// ── Suggestion d'agenda via Haiku ────────────────────────────────

const HAIKU_MODEL = "claude-haiku-4-5-20251001";
const SUGGESTED_AGENDA_MAX = 200;

const AGENDA_PROMPT = [
  "Tu es l'assistant d'un founder pressé. Pour le meeting fourni, tu produis une suggestion d'agenda courte et actionable.",
  "",
  "RÈGLES STRICTES :",
  "- Maximum 200 caractères.",
  "- Maximum 3 bullets séparés par ' · ' (interpunct).",
  "- Français.",
  "- Pas de mono caps, pas de markdown, pas de fence.",
  "- Concentre-toi sur les points concrets à discuter (décisions à prendre, blocages à lever, livrables à valider).",
  "",
  "FORMAT : texte plat, ex : « Valider roadmap Q3 · Aligner pricing · Décider next call »",
].join("\n");

async function generateSuggestedAgenda(
  eventTitle: string,
  participants: PreMeetingParticipant[],
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return "";

  // Compose un input compact pour Haiku.
  const participantSnippets = participants
    .slice(0, 5)
    .map((p) => {
      const head = p.name ?? p.email;
      const ctx = p.kgSummary ? ` (${p.kgSummary})` : "";
      return `- ${head}${ctx}`;
    })
    .join("\n");

  const userMessage = [
    `Meeting : ${eventTitle}`,
    "",
    "Participants :",
    participantSnippets || "(aucun participant identifié)",
  ].join("\n");

  const anthropic = new Anthropic({ apiKey });
  try {
    const res = await anthropic.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 200,
      system: AGENDA_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });
    const block = res.content[0];
    const raw = block?.type === "text" ? block.text : "";
    return raw.trim().replace(/\s+/g, " ").slice(0, SUGGESTED_AGENDA_MAX);
  } catch (err) {
    console.warn("[pre-meeting-intel] Haiku agenda échoué :", err);
    return "";
  }
}

// ── API publique ─────────────────────────────────────────────────

interface IntelScope {
  userId: string;
  tenantId: string;
}

/**
 * Génère le briefing pré-meeting pour un event donné.
 * Cache 5min par (userId, eventId).
 *
 * Ordre des opérations :
 *  1. Cache hit → return.
 *  2. Fetch event sur fenêtre 0-60min → filter par eventId.
 *  3. Pour chaque attendee → KG lookup + lastInteractions.
 *  4. Génère agenda via Haiku.
 */
export async function getPreMeetingIntel(
  scope: IntelScope,
  eventId: string,
): Promise<PreMeetingIntel | null> {
  const key = cacheKey(scope.userId, eventId);
  const now = Date.now();

  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) return cached.intel;

  const events = await listUpcomingEventsWithAttendees(scope.userId, 60);
  const event = events.find((e) => e.id === eventId);
  if (!event) return null;

  // Pour chaque attendee, on parallélise KG lookup + lastInteractions.
  const participants: PreMeetingParticipant[] = await Promise.all(
    event.attendees.map(async (att): Promise<PreMeetingParticipant> => {
      try {
        const node = await findPersonNodeByEmail(scope.userId, scope.tenantId, att.email);
        const last = node ? await getLastInteractions(scope.userId, scope.tenantId, node.id) : [];
        const kgSummary = buildKgSummary(node, last);
        const lastInteraction = last.length > 0 ? last[0] : null;
        return {
          email: att.email,
          name: att.name,
          kgSummary,
          lastInteraction,
        };
      } catch (err) {
        console.warn(`[pre-meeting-intel] KG lookup échoué pour ${att.email} :`, err);
        return {
          email: att.email,
          name: att.name,
          kgSummary: null,
          lastInteraction: null,
        };
      }
    }),
  );

  const suggestedAgenda = await generateSuggestedAgenda(event.title, participants);

  const intel: PreMeetingIntel = {
    eventId: event.id,
    eventTitle: event.title,
    startsAt: event.startsAt,
    participants,
    suggestedAgenda,
    generatedAt: now,
  };

  cache.set(key, { intel, expiresAt: now + CACHE_TTL_MS });
  return intel;
}

/** Test-only : vide le cache. */
export function __clearPreMeetingIntelCache(): void {
  cache.clear();
}
