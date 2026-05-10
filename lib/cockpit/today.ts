/**
 * Cockpit "Today" — Orchestrateur d'agrégation pour la home Cockpit.
 *
 * Pivot v1.6 (2026-05-10, "OS humain") : suppression watchlist KPIs founder
 * (MRR/ARR/Runway/Pipeline), hospitality vertical, counts assets/missions/
 * reports en hero. La home redevient un OS personnel : briefing humain,
 * agenda du jour, ce que l'agent fait, suggestions douces "quand tu auras 5 min".
 *
 * Fail-soft : chaque source est isolée. Une erreur sur l'une n'impacte pas
 * les autres.
 *
 * Sources :
 *  - Briefing : conversation-summary (cache existant, pas d'appel LLM ici).
 *  - Agenda : Google Calendar live (Composio ou SSO natif), fenêtre 24h.
 *  - Agent working : missions running + planifiées du jour.
 *  - Suggestions : applicable reports + signaux contextuels.
 */

import { CATALOG, getApplicableReports } from "@/lib/reports/catalog";
import { getAllMissionOps } from "@/lib/engine/runtime/missions/ops-store";
import { getScheduledMissions } from "@/lib/engine/runtime/state/adapter";
import { getAllMissions as getMemoryMissions } from "@/lib/engine/runtime/missions/store";
import { getMonthlyMissionCost } from "@/lib/engine/runtime/missions/budget";
import { getConnectionsByScope } from "@/lib/connectors/control-plane/store";
import { getAllServiceIds, getProviderIdForService } from "@/lib/integrations/service-map";
import { loadLatestInboxBrief } from "@/lib/inbox/store";
import { getTokens } from "@/lib/platform/auth/tokens";
import type { InboxBrief } from "@/lib/inbox/inbox-brief";
import { getLiveAgenda } from "./agenda-live";

interface CockpitScope {
  userId: string;
  tenantId: string;
  workspaceId: string;
}

interface CockpitMission {
  id: string;
  name: string;
  status: "idle" | "running" | "success" | "failed" | "blocked";
  runningSince: number | null;
  lastRunAt: number | null;
  lastError: string | null;
  /** Budget mensuel max USD (S3-D). Null si pas de cap configuré. */
  budgetUsd: number | null;
  /** Cumul USD des runs du mois calendaire courant. 0 si pas de budget. */
  currentMonthUsd: number;
}

interface CockpitSuggestion {
  id: string;
  title: string;
  description: string;
  status: "ready" | "partial";
  requiredApps: ReadonlyArray<string>;
  missingApps: ReadonlyArray<string>;
}

interface CockpitFavoriteReport {
  id: string;
  title: string;
  domain: string;
}

export interface CockpitAgendaItem {
  id: string;
  title: string;
  startsAt: number;
  source: "mock" | "live";
}

interface CockpitInboxSection {
  brief: InboxBrief | null;
  /** True quand le brief est plus vieux que 1h ou inexistant → propose Refresh. */
  stale: boolean;
  /** True quand l'utilisateur n'a connecté ni Gmail ni Slack → CTA /apps. */
  needsConnection: boolean;
}

export interface CockpitTodayPayload {
  agenda: CockpitAgendaItem[];
  /** True si l'user a un refresh token Google (NextAuth) ou une connexion
   *  Composio "google"/"gmail". */
  calendarConnected: boolean;
  missionsRunning: CockpitMission[];
  suggestions: CockpitSuggestion[];
  favoriteReports: CockpitFavoriteReport[];
  inbox: CockpitInboxSection;
  generatedAt: number;
}

const MAX_MISSIONS_RUNNING = 4;
const MAX_SUGGESTIONS = 3;
const MAX_FAVORITE_REPORTS = 3;
const MAX_AGENDA_ITEMS = 4;

/**
 * Fail-soft wrapper : exécute le getter, retourne fallback si throw.
 */
async function safe<T>(label: string, fn: () => Promise<T> | T, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.warn(`[cockpit/today] source "${label}" en erreur, fallback appliqué:`, err);
    return fallback;
  }
}

async function buildMissionsRunning(scope: CockpitScope): Promise<CockpitMission[]> {
  const opsMap = getAllMissionOps();

  let missions = await safe(
    "missions.scheduled",
    () =>
      getScheduledMissions({
        userId: scope.userId,
        tenantId: scope.tenantId,
        workspaceId: scope.workspaceId,
      }),
    [] as Awaited<ReturnType<typeof getScheduledMissions>>,
  );

  if (missions.length === 0) {
    missions = getMemoryMissions()
      .filter(
        (m) =>
          m.userId === scope.userId &&
          m.tenantId === scope.tenantId &&
          m.workspaceId === scope.workspaceId,
      )
      .map((m) => ({
        id: m.id,
        tenantId: m.tenantId,
        workspaceId: m.workspaceId,
        userId: m.userId,
        name: m.name,
        input: m.input,
        schedule: m.schedule,
        enabled: m.enabled,
        createdAt: m.createdAt,
        lastRunAt: m.lastRunAt,
        lastRunId: m.lastRunId,
      }));
  }

  const knownIds = new Set<string>();
  const enriched: CockpitMission[] = await Promise.all(
    missions.map(async (m) => {
      knownIds.add(m.id);
      const live = opsMap.get(m.id);
      const hasBudget = typeof m.budgetUsd === "number" && m.budgetUsd > 0;
      const currentMonthUsd = hasBudget
        ? await safe(`mission.budget.${m.id}`, () => getMonthlyMissionCost(m.id), 0)
        : 0;
      return {
        id: m.id,
        name: m.name,
        status: (live?.status ?? m.lastRunStatus ?? "idle") as CockpitMission["status"],
        runningSince: live?.runningSince ?? null,
        lastRunAt: live?.lastRunAt ?? m.lastRunAt ?? null,
        lastError: live?.lastError ?? m.lastError ?? null,
        budgetUsd: hasBudget ? (m.budgetUsd as number) : null,
        currentMonthUsd,
      };
    }),
  );

  for (const [missionId, op] of opsMap.entries()) {
    if (knownIds.has(missionId)) continue;
    enriched.push({
      id: missionId,
      name: missionId,
      // Q3-D — `awaiting_approval` est exposé via `approval` côté ops API.
      // Pour les surfaces cockpit qui n'ont pas encore intégré l'état, on
      // mappe en "blocked" (sémantiquement proche : la mission est gated).
      status:
        op.status === "awaiting_approval"
          ? "blocked"
          : (op.status as CockpitMission["status"]),
      runningSince: op.runningSince ?? null,
      lastRunAt: op.lastRunAt ?? null,
      lastError: op.lastError ?? null,
      budgetUsd: null,
      currentMonthUsd: 0,
    });
  }

  enriched.sort((a, b) => {
    if (a.status === "running" && b.status !== "running") return -1;
    if (b.status === "running" && a.status !== "running") return 1;
    return (b.lastRunAt ?? 0) - (a.lastRunAt ?? 0);
  });

  return enriched
    .filter((m) => m.status === "running" || m.lastRunAt)
    .slice(0, MAX_MISSIONS_RUNNING);
}

async function buildSuggestions(scope: CockpitScope): Promise<CockpitSuggestion[]> {
  const conns = await safe(
    "suggestions.connections",
    () =>
      getConnectionsByScope({
        tenantId: scope.tenantId,
        workspaceId: scope.workspaceId,
        userId: scope.userId,
      }),
    [] as Awaited<ReturnType<typeof getConnectionsByScope>>,
  );

  const connectedProviders = conns
    .filter((c) => c.status === "connected")
    .map((c) => c.provider);

  if (connectedProviders.length === 0) return [];

  const providerSet = new Set(connectedProviders);
  const connectedServiceIds = getAllServiceIds().filter((sid) => {
    const pid = getProviderIdForService(sid);
    return pid !== undefined && providerSet.has(pid);
  });

  const applicable = getApplicableReports([
    ...connectedProviders,
    ...connectedServiceIds,
  ]);

  return applicable
    .filter(
      (r): r is typeof r & { status: "ready" | "partial" } =>
        r.status === "ready" || r.status === "partial",
    )
    .slice(0, MAX_SUGGESTIONS)
    .map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      status: r.status,
      requiredApps: r.requiredApps,
      missingApps: r.missingApps,
    }));
}

function buildFavoriteReports(): CockpitFavoriteReport[] {
  return CATALOG.slice(0, MAX_FAVORITE_REPORTS).map((c) => ({
    id: c.id,
    title: c.title,
    domain: String(c.domain),
  }));
}

const INBOX_STALE_MS = 60 * 60_000; // 1h

async function buildInbox(scope: CockpitScope): Promise<CockpitInboxSection> {
  const conns = await safe(
    "inbox.connections",
    () =>
      getConnectionsByScope({
        tenantId: scope.tenantId,
        workspaceId: scope.workspaceId,
        userId: scope.userId,
      }),
    [] as Awaited<ReturnType<typeof getConnectionsByScope>>,
  );

  const connectedProviders = new Set(
    conns.filter((c) => c.status === "connected").map((c) => c.provider),
  );
  const hasGmail = connectedProviders.has("google") || connectedProviders.has("gmail");
  const hasSlack = connectedProviders.has("slack");
  const needsConnection = !hasGmail && !hasSlack;

  const brief = await safe<InboxBrief | null>(
    "inbox.latest",
    () => loadLatestInboxBrief(scope.userId),
    null,
  );

  const ageMs = brief ? Date.now() - brief.generatedAt : Infinity;
  const stale = !brief || ageMs > INBOX_STALE_MS;

  const filteredItems = brief
    ? brief.items.filter((it) => !it.snoozedUntil || it.snoozedUntil <= Date.now())
    : [];

  return {
    brief: brief ? { ...brief, items: filteredItems } : null,
    stale,
    needsConnection,
  };
}

async function isCalendarConnected(scope: CockpitScope): Promise<boolean> {
  try {
    const tokens = await getTokens(scope.userId);
    if (tokens.refreshToken) return true;
  } catch {
    // ignore — fallback Composio
  }

  try {
    const conns = await getConnectionsByScope({
      tenantId: scope.tenantId,
      workspaceId: scope.workspaceId,
      userId: scope.userId,
    });
    return conns.some(
      (c) => c.status === "connected" && (c.provider === "google" || c.provider === "gmail"),
    );
  } catch {
    return false;
  }
}

export async function getCockpitToday(scope: CockpitScope): Promise<CockpitTodayPayload> {
  const [missionsRunning, suggestions, inbox, calendarConnected, agenda] = await Promise.all([
    safe("missionsRunning", () => buildMissionsRunning(scope), [] as CockpitMission[]),
    safe("suggestions", () => buildSuggestions(scope), [] as CockpitSuggestion[]),
    safe(
      "inbox",
      () => buildInbox(scope),
      { brief: null, stale: true, needsConnection: false } satisfies CockpitInboxSection,
    ),
    safe("calendarConnected", () => isCalendarConnected(scope), false),
    safe(
      "agenda.live",
      () => getLiveAgenda({ userId: scope.userId, tenantId: scope.tenantId }),
      [] as CockpitAgendaItem[],
    ),
  ]);

  const favoriteReports = buildFavoriteReports();

  return {
    agenda: agenda.slice(0, MAX_AGENDA_ITEMS),
    calendarConnected,
    missionsRunning,
    suggestions,
    favoriteReports,
    inbox,
    generatedAt: Date.now(),
  };
}
