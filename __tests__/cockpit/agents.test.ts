import { describe, it, expect } from "vitest";
import {
  AGENT_ROLES,
  AGENT_METADATA,
  mapToolToService,
  classifyToolAction,
  mapEventToRole,
  deriveActiveRolesFromEvents,
  deriveCoActivePairs,
  deriveActiveServicesFromEvents,
  ROLE_ACTIVE_TTL_MS,
  SERVICE_ACTIVE_TTL_MS,
  CO_ACTIVE_WINDOW_MS,
} from "@/lib/cockpit/agents";
import type { StreamEvent } from "@/stores/runtime";

const now = 1_700_000_000_000;
const ev = (
  type: string,
  ts: number,
  extra: Record<string, unknown> = {},
): StreamEvent => ({ type, timestamp: ts, ...extra });

describe("AGENT_METADATA", () => {
  it("contient les 6 rôles", () => {
    expect(AGENT_ROLES.length).toBe(6);
    for (const id of AGENT_ROLES) {
      expect(AGENT_METADATA[id]).toBeDefined();
      expect(AGENT_METADATA[id].label).toBeTruthy();
      expect(AGENT_METADATA[id].tagline).toBeTruthy();
    }
  });
});

describe("mapToolToService", () => {
  it("extrait le préfixe avant le premier underscore", () => {
    expect(mapToolToService("SLACK_SEND_MESSAGE")).toBe("slack");
    expect(mapToolToService("LINEAR_CREATE_ISSUE")).toBe("linear");
    expect(mapToolToService("STRIPE_LIST_SUBSCRIPTIONS")).toBe("stripe");
  });

  it("résout les alias Google", () => {
    expect(mapToolToService("GOOGLECALENDAR_LIST_EVENTS")).toBe("calendar");
    expect(mapToolToService("GOOGLEDRIVE_SEARCH_FILES")).toBe("drive");
    expect(mapToolToService("GOOGLEMAIL_SEND")).toBe("gmail");
  });

  it("retourne null sur tool name vide ou sans underscore", () => {
    expect(mapToolToService("")).toBeNull();
    expect(mapToolToService("INVALID")).toBeNull();
  });
});

describe("classifyToolAction", () => {
  it("identifie les writes", () => {
    expect(classifyToolAction("SLACK_SEND_MESSAGE")).toBe("write");
    expect(classifyToolAction("LINEAR_CREATE_ISSUE")).toBe("write");
    expect(classifyToolAction("NOTION_UPDATE_PAGE")).toBe("write");
    expect(classifyToolAction("GMAIL_DELETE_DRAFT")).toBe("write");
  });

  it("identifie les reads", () => {
    expect(classifyToolAction("GMAIL_LIST_MESSAGES")).toBe("read");
    expect(classifyToolAction("HUBSPOT_SEARCH_DEALS")).toBe("read");
    expect(classifyToolAction("STRIPE_GET_CUSTOMER")).toBe("read");
    expect(classifyToolAction("DRIVE_FETCH_FILE")).toBe("read");
  });

  it("retourne unknown si pattern non reconnu", () => {
    expect(classifyToolAction("FOO_BAR")).toBe("unknown");
    expect(classifyToolAction("")).toBe("unknown");
  });
});

describe("mapEventToRole", () => {
  it("mappe tool_call writes vers pilot", () => {
    const e = ev("tool_call_started", now, { toolName: "SLACK_SEND_MESSAGE" });
    expect(mapEventToRole(e)).toBe("pilot");
  });

  it("mappe tool_call reads vers delve", () => {
    const e = ev("tool_call_completed", now, { toolName: "GMAIL_LIST_MESSAGES" });
    expect(mapEventToRole(e)).toBe("delve");
  });

  it("mappe asset_generated kind=report vers scribe", () => {
    const e = ev("asset_generated", now, { asset_type: "report" });
    expect(mapEventToRole(e)).toBe("scribe");
  });

  it("mappe events kg_* vers cortex", () => {
    expect(mapEventToRole(ev("kg_ingested", now))).toBe("cortex");
    expect(mapEventToRole(ev("kg_search_completed", now))).toBe("cortex");
  });

  it("mappe notifications/watchlist/briefing vers pulse", () => {
    expect(mapEventToRole(ev("notification_created", now))).toBe("pulse");
    expect(mapEventToRole(ev("watchlist_anomaly", now))).toBe("pulse");
    expect(mapEventToRole(ev("briefing_ready", now))).toBe("pulse");
  });

  it("mappe auth/permissions vers warden", () => {
    expect(mapEventToRole(ev("auth_required", now))).toBe("warden");
    expect(mapEventToRole(ev("payment_required", now))).toBe("warden");
    expect(mapEventToRole(ev("request_connection", now))).toBe("warden");
  });

  it("retourne null pour events non mappés", () => {
    expect(mapEventToRole(ev("run_started", now))).toBeNull();
    expect(mapEventToRole(ev("connection_status", now))).toBeNull();
    expect(mapEventToRole(ev("heartbeat", now))).toBeNull();
  });

  it("retourne null pour tool_call sans toolName", () => {
    expect(mapEventToRole(ev("tool_call_started", now))).toBeNull();
  });
});

describe("deriveActiveRolesFromEvents", () => {
  it("liste vide quand aucun event", () => {
    expect(deriveActiveRolesFromEvents([], now)).toEqual([]);
  });

  it("filtre les events plus vieux que ROLE_ACTIVE_TTL_MS", () => {
    const events: StreamEvent[] = [
      ev("tool_call_started", now - ROLE_ACTIVE_TTL_MS - 100, {
        toolName: "SLACK_SEND_MESSAGE",
      }),
    ];
    expect(deriveActiveRolesFromEvents(events, now)).toEqual([]);
  });

  it("garde uniquement le plus récent par rôle", () => {
    const events: StreamEvent[] = [
      ev("tool_call_started", now - 100, { toolName: "SLACK_SEND_MESSAGE", run_id: "r1" }),
      ev("tool_call_completed", now - 200, { toolName: "LINEAR_CREATE_ISSUE", run_id: "r1" }),
    ];
    const active = deriveActiveRolesFromEvents(events, now);
    expect(active.length).toBe(1);
    expect(active[0].id).toBe("pilot");
    expect(active[0].lastEventTs).toBe(now - 100);
  });

  it("active plusieurs rôles distincts", () => {
    const events: StreamEvent[] = [
      ev("tool_call_started", now - 100, { toolName: "GMAIL_SEARCH", run_id: "r1" }),
      ev("kg_ingested", now - 200, { run_id: "r1" }),
    ];
    const ids = deriveActiveRolesFromEvents(events, now).map((r) => r.id).sort();
    expect(ids).toEqual(["cortex", "delve"]);
  });
});

describe("deriveCoActivePairs", () => {
  it("trace une ligne entre 2 rôles co-actifs même runId", () => {
    const active = [
      { id: "scribe" as const, lastEventTs: now - 100, runId: "r1" },
      { id: "cortex" as const, lastEventTs: now - 500, runId: "r1" },
    ];
    expect(deriveCoActivePairs(active)).toEqual([["scribe", "cortex"]]);
  });

  it("ne trace pas de ligne si runIds différents", () => {
    const active = [
      { id: "scribe" as const, lastEventTs: now - 100, runId: "r1" },
      { id: "pilot" as const, lastEventTs: now - 200, runId: "r2" },
    ];
    expect(deriveCoActivePairs(active)).toEqual([]);
  });

  it("ne trace pas de ligne au-delà de CO_ACTIVE_WINDOW_MS", () => {
    const active = [
      { id: "scribe" as const, lastEventTs: now, runId: "r1" },
      { id: "cortex" as const, lastEventTs: now - CO_ACTIVE_WINDOW_MS - 100, runId: "r1" },
    ];
    expect(deriveCoActivePairs(active)).toEqual([]);
  });

  it("ne trace pas de ligne si runId null", () => {
    const active = [
      { id: "scribe" as const, lastEventTs: now, runId: null },
      { id: "pilot" as const, lastEventTs: now - 100, runId: null },
    ];
    expect(deriveCoActivePairs(active)).toEqual([]);
  });
});

describe("deriveActiveServicesFromEvents", () => {
  it("liste vide sans events", () => {
    expect(deriveActiveServicesFromEvents([], now)).toEqual([]);
  });

  it("dédoublonne et garde le timestamp le plus récent", () => {
    const events: StreamEvent[] = [
      ev("tool_call_started", now - 100, { toolName: "SLACK_LIST_CHANNELS" }),
      ev("tool_call_completed", now - 200, { toolName: "SLACK_SEND_MESSAGE" }),
    ];
    const services = deriveActiveServicesFromEvents(events, now);
    expect(services.length).toBe(1);
    expect(services[0].id).toBe("slack");
    expect(services[0].lastEventTs).toBe(now - 100);
  });

  it("filtre les events au-delà de SERVICE_ACTIVE_TTL_MS", () => {
    const events: StreamEvent[] = [
      ev("tool_call_started", now - SERVICE_ACTIVE_TTL_MS - 100, {
        toolName: "SLACK_SEND_MESSAGE",
      }),
    ];
    expect(deriveActiveServicesFromEvents(events, now)).toEqual([]);
  });

  it("trie par lastEventTs desc et limite à maxServices", () => {
    const events: StreamEvent[] = [
      ev("tool_call_started", now - 1000, { toolName: "SLACK_SEND" }),
      ev("tool_call_started", now - 500, { toolName: "GMAIL_SEND" }),
      ev("tool_call_started", now - 100, { toolName: "LINEAR_CREATE" }),
    ];
    const services = deriveActiveServicesFromEvents(events, now, 2);
    expect(services.map((s) => s.id)).toEqual(["linear", "gmail"]);
  });

  it("ignore les events non tool_call", () => {
    const events: StreamEvent[] = [
      ev("run_started", now),
      ev("asset_generated", now, { asset_type: "report" }),
    ];
    expect(deriveActiveServicesFromEvents(events, now)).toEqual([]);
  });
});
