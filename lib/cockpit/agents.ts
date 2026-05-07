/**
 * Cockpit Agents — projection sémantique des events SSE en 6 rôles.
 *
 * **Lentille honnête** : les 6 "agents" (pilot/scribe/delve/pulse/warden/cortex)
 * ne sont PAS un système multi-agents. C'est une lecture sémantique des events
 * SSE de l'orchestrateur unique. Chaque event SSE est mappé à un rôle qui en
 * porte la responsabilité. Quand 2 rôles sont co-actifs dans la même run, on
 * trace une ligne entre eux dans la constellation système (rail droit, Strate 2).
 *
 * Aucune ligne décorative : si pas de co-activation réelle dans la même runId
 * à intervalle ≤ CO_ACTIVE_WINDOW_MS, pas de ligne.
 *
 * Mapping documenté dans
 * [docs/screens/right-panel-dashboard.md](docs/screens/right-panel-dashboard.md) §3.
 */

import type { StreamEvent } from "@/stores/runtime";

// ── Rôles ────────────────────────────────────────────────────

export const AGENT_ROLES = [
  "pilot",
  "scribe",
  "delve",
  "cortex",
  "pulse",
  "warden",
] as const;

export type AgentRoleId = (typeof AGENT_ROLES)[number];

export interface AgentMeta {
  label: string;
  tagline: string;
  /**
   * Action "Ouvrir →" depuis la fiche Strate 5 quand un rôle est sélectionné.
   * `kind: "route"` → router.push, `kind: "stage"` → useStageStore.setMode.
   */
  openTarget:
    | { kind: "route"; path: string }
    | { kind: "stage"; mode: "kg" | "voice" };
}

export const AGENT_METADATA: Record<AgentRoleId, AgentMeta> = {
  pilot: {
    label: "Pilot",
    tagline: "Exécute tes actions externes",
    openTarget: { kind: "route", path: "/missions" },
  },
  scribe: {
    label: "Scribe",
    tagline: "Recherche, rédige, livre",
    openTarget: { kind: "route", path: "/reports" },
  },
  delve: {
    label: "Delve",
    tagline: "Lit tes sources et remonte les signaux",
    openTarget: { kind: "route", path: "/apps" },
  },
  cortex: {
    label: "Cortex",
    tagline: "Tisse ton graphe de connaissance",
    openTarget: { kind: "stage", mode: "kg" },
  },
  pulse: {
    label: "Pulse",
    tagline: "Veille, alertes, anomalies",
    openTarget: { kind: "route", path: "/" },
  },
  warden: {
    label: "Warden",
    tagline: "Auth, permissions, quotas",
    openTarget: { kind: "route", path: "/apps" },
  },
};

// ── Service ID extraction depuis tool name ──────────────────

/**
 * Composio toolname conventions : `<SERVICE>_<ACTION>` ALL_CAPS.
 * Aliases : `GOOGLECALENDAR_*` → calendar, `GOOGLEDRIVE_*` → drive, etc.
 */
const SERVICE_ALIASES: Record<string, string> = {
  GOOGLECALENDAR: "calendar",
  GOOGLEDRIVE: "drive",
  GOOGLEMAIL: "gmail",
};

export function mapToolToService(toolName: string): string | null {
  if (!toolName) return null;
  const upper = toolName.toUpperCase();
  const firstUnderscore = upper.indexOf("_");
  if (firstUnderscore === -1) return null;
  const prefix = upper.slice(0, firstUnderscore);
  return SERVICE_ALIASES[prefix] ?? prefix.toLowerCase();
}

// ── Tool action classification (read vs write) ──────────────

const WRITE_ACTION_TOKENS = [
  "_SEND",
  "_CREATE",
  "_UPDATE",
  "_POST",
  "_DELETE",
  "_ADD",
  "_REMOVE",
  "_PATCH",
  "_PUT",
  "_INSERT",
  "_REPLACE",
  "_REPLY",
  "_ARCHIVE",
  "_MOVE",
];

const READ_ACTION_TOKENS = [
  "_GET",
  "_LIST",
  "_SEARCH",
  "_FETCH",
  "_READ",
  "_QUERY",
  "_FIND",
  "_SHOW",
  "_DESCRIBE",
];

export type ToolKind = "write" | "read" | "unknown";

export function classifyToolAction(toolName: string): ToolKind {
  if (!toolName) return "unknown";
  const upper = toolName.toUpperCase();
  if (WRITE_ACTION_TOKENS.some((t) => upper.includes(t))) return "write";
  if (READ_ACTION_TOKENS.some((t) => upper.includes(t))) return "read";
  return "unknown";
}

// ── Event → role mapping ─────────────────────────────────────

/**
 * Décide quel rôle "porte" un event SSE donné.
 * Retourne null si l'event n'est pas mappé à un rôle (ex: connection_*,
 * heartbeat, debug). Les events non mappés sont ignorés silencieusement.
 */
export function mapEventToRole(event: StreamEvent): AgentRoleId | null {
  const type = event.type;

  // Tool calls : write → pilot, read → delve
  if (type === "tool_call_started" || type === "tool_call_completed") {
    const toolName = (event as Record<string, unknown>).toolName as string | undefined;
    if (!toolName) return null;
    const kind = classifyToolAction(toolName);
    if (kind === "write") return "pilot";
    if (kind === "read") return "delve";
    return null;
  }

  // Asset generation type=report → scribe
  if (type === "asset_generated") {
    const kind = (event as Record<string, unknown>).asset_type as string | undefined;
    if (kind === "report" || kind === "doc" || kind === "brief") return "scribe";
    return null;
  }

  // Knowledge graph events → cortex
  if (type.startsWith("kg_") || type === "kg.update" || type === "kg.search") {
    return "cortex";
  }

  // Notifications / watchlist / briefing → pulse
  if (
    type === "notification_created" ||
    type === "watchlist_anomaly" ||
    type === "briefing_ready" ||
    type === "briefing_updated"
  ) {
    return "pulse";
  }

  // Auth / permissions / quotas → warden
  if (
    type === "auth_required" ||
    type === "scope_denied" ||
    type === "quota_exceeded" ||
    type === "payment_required" ||
    type === "request_connection"
  ) {
    return "warden";
  }

  // Plan steps : on peut déduire selon le step kind si dispo
  if (type === "plan_step_started" || type === "plan_step_completed") {
    const stepKind = (event as Record<string, unknown>).kind as string | undefined;
    if (!stepKind) return null;
    if (stepKind === "research" || stepKind === "draft" || stepKind === "summarize") return "scribe";
    if (stepKind === "kg_query" || stepKind === "kg_ingest") return "cortex";
    if (stepKind === "notify" || stepKind === "watch") return "pulse";
    if (stepKind === "tool_call") {
      const toolName = (event as Record<string, unknown>).toolName as string | undefined;
      if (toolName) {
        const k = classifyToolAction(toolName);
        if (k === "write") return "pilot";
        if (k === "read") return "delve";
      }
      return null;
    }
    return null;
  }

  return null;
}

// ── Active roles derivation ─────────────────────────────────

/**
 * Fenêtre temporelle pour considérer 2 rôles "co-actifs" dans la même run.
 * Au-delà, on ne trace plus de ligne entre eux.
 */
export const CO_ACTIVE_WINDOW_MS = 2_000;

/**
 * Durée pendant laquelle un rôle reste considéré "actif" après son dernier event.
 * 1.2 s : assez pour une lecture humaine stable sans clignotement parasite
 * quand les events SSE arrivent en burst, assez court pour rester live.
 */
export const ROLE_ACTIVE_TTL_MS = 1_200;

export interface ActiveRole {
  id: AgentRoleId;
  /** Timestamp du dernier event SSE qui a activé ce rôle. */
  lastEventTs: number;
  /** runId du dernier event qui a activé ce rôle (pour grouper les co-actifs). */
  runId: string | null;
}

/**
 * Dérive la liste des rôles actuellement actifs depuis le buffer d'events SSE
 * du runtime store. Un rôle est actif si un event mappé sur lui est survenu
 * dans les `ROLE_ACTIVE_TTL_MS` derniers ms.
 *
 * @param events Buffer d'events tel que retourné par useRuntimeStore.events
 *               (ordre : plus récent en premier, voir runtime.ts MAX_EVENTS)
 * @param now Timestamp de référence (Date.now() par défaut, injectable pour tests)
 */
export function deriveActiveRolesFromEvents(
  events: StreamEvent[],
  now: number = Date.now(),
): ActiveRole[] {
  const latestByRole = new Map<AgentRoleId, ActiveRole>();
  for (const ev of events) {
    if (now - ev.timestamp > ROLE_ACTIVE_TTL_MS) continue;
    const role = mapEventToRole(ev);
    if (!role) continue;
    if (!latestByRole.has(role)) {
      latestByRole.set(role, {
        id: role,
        lastEventTs: ev.timestamp,
        runId: ((ev as Record<string, unknown>).run_id as string | undefined) ?? null,
      });
    }
  }
  return Array.from(latestByRole.values());
}

/**
 * Dérive les paires de rôles co-actifs (à connecter par une ligne dans la
 * constellation). Règle : 2 rôles connectés ssi
 *   - tous deux actifs (cf. `deriveActiveRolesFromEvents`)
 *   - même `runId` (non-null)
 *   - leurs timestamps sont à ≤ `CO_ACTIVE_WINDOW_MS` l'un de l'autre
 */
export function deriveCoActivePairs(
  activeRoles: ActiveRole[],
): Array<[AgentRoleId, AgentRoleId]> {
  const pairs: Array<[AgentRoleId, AgentRoleId]> = [];
  for (let i = 0; i < activeRoles.length; i++) {
    for (let j = i + 1; j < activeRoles.length; j++) {
      const a = activeRoles[i];
      const b = activeRoles[j];
      if (!a.runId || !b.runId || a.runId !== b.runId) continue;
      const dt = Math.abs(a.lastEventTs - b.lastEventTs);
      if (dt > CO_ACTIVE_WINDOW_MS) continue;
      pairs.push([a.id, b.id]);
    }
  }
  return pairs;
}

// ── Service activations (Strate 1) ───────────────────────────

export interface ActiveService {
  id: string;
  lastEventTs: number;
}

export const SERVICE_ACTIVE_TTL_MS = 30_000;

/**
 * Dérive la liste des services Composio sollicités récemment depuis le
 * buffer d'events SSE. Un service est actif si un `tool_call_*` sur ce
 * service est survenu dans les `SERVICE_ACTIVE_TTL_MS` derniers ms.
 *
 * Limite : `maxServices` (défaut 8) — au-delà, on garde les plus récents.
 */
export function deriveActiveServicesFromEvents(
  events: StreamEvent[],
  now: number = Date.now(),
  maxServices = 8,
): ActiveService[] {
  const latestByService = new Map<string, ActiveService>();
  for (const ev of events) {
    if (ev.type !== "tool_call_started" && ev.type !== "tool_call_completed") continue;
    if (now - ev.timestamp > SERVICE_ACTIVE_TTL_MS) continue;
    const toolName = (ev as Record<string, unknown>).toolName as string | undefined;
    if (!toolName) continue;
    const serviceId = mapToolToService(toolName);
    if (!serviceId) continue;
    if (!latestByService.has(serviceId)) {
      latestByService.set(serviceId, { id: serviceId, lastEventTs: ev.timestamp });
    }
  }
  return Array.from(latestByService.values())
    .sort((a, b) => b.lastEventTs - a.lastEventTs)
    .slice(0, maxServices);
}
