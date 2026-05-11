/**
 * F-011 — allowedTools effectif runtime
 *
 * Vérifie que le toolset final est réellement restreint quand _allowedTools
 * est fourni, et que les tools hors allowlist sont bien supprimés.
 */

import { describe, it, expect } from "vitest";

/**
 * Simule la logique d'intersection de ai-pipeline.ts
 * (copie exacte du bloc F-011 pour tester la logique isolément).
 */
function applyAllowedToolsFilter(
  aiTools: Record<string, unknown>,
  allowedTools: string[] | undefined,
): Record<string, unknown> {
  const result = { ...aiTools };
  if (allowedTools && allowedTools.length > 0) {
    const allowedSet = new Set(allowedTools);
    for (const name of Object.keys(result)) {
      if (!allowedSet.has(name)) {
        delete result[name];
      }
    }
  }
  return result;
}

/**
 * Simule la logique d'isolation scheduler (F-012).
 */
const SCHEDULER_RECURSIVE_TOOLS = [
  "create_scheduled_mission",
  "request_daily_brief",
  "run_mission",
  "request_connection",
];

function applySchedulerIsolation(
  aiTools: Record<string, unknown>,
  missionId: string | undefined,
): Record<string, unknown> {
  const result = { ...aiTools };
  if (missionId) {
    for (const name of SCHEDULER_RECURSIVE_TOOLS) {
      delete result[name];
    }
  }
  return result;
}

describe("F-011 — allowedTools intersection effectif", () => {
  const fullToolset = {
    get_messages: {},
    get_calendar_events: {},
    search_web: {},
    generate_report: {},
    send_email: {},
    create_scheduled_mission: {},
    request_connection: {},
  };

  it("restreint le toolset aux tools listés dans _allowedTools", () => {
    const allowed = ["get_messages", "search_web"];
    const result = applyAllowedToolsFilter(fullToolset, allowed);

    expect(Object.keys(result)).toEqual(expect.arrayContaining(["get_messages", "search_web"]));
    expect(Object.keys(result)).not.toContain("send_email");
    expect(Object.keys(result)).not.toContain("create_scheduled_mission");
    expect(Object.keys(result)).not.toContain("get_calendar_events");
    expect(Object.keys(result)).not.toContain("generate_report");
    expect(Object.keys(result)).not.toContain("request_connection");
  });

  it("ne filtre rien si _allowedTools est undefined", () => {
    const result = applyAllowedToolsFilter(fullToolset, undefined);
    expect(Object.keys(result)).toHaveLength(Object.keys(fullToolset).length);
  });

  it("ne filtre rien si _allowedTools est vide", () => {
    const result = applyAllowedToolsFilter(fullToolset, []);
    expect(Object.keys(result)).toHaveLength(Object.keys(fullToolset).length);
  });

  it("retourne un toolset vide si _allowedTools ne matche aucun tool", () => {
    const result = applyAllowedToolsFilter(fullToolset, ["tool_inexistant"]);
    expect(Object.keys(result)).toHaveLength(0);
  });
});

describe("F-012 — scheduler context retire les tools récursifs", () => {
  const fullToolset = {
    get_messages: {},
    search_web: {},
    create_scheduled_mission: {},
    request_daily_brief: {},
    run_mission: {},
    request_connection: {},
    generate_report: {},
  };

  it("retire create_scheduled_mission quand missionId est présent", () => {
    const result = applySchedulerIsolation(fullToolset, "mission-123");
    expect(Object.keys(result)).not.toContain("create_scheduled_mission");
  });

  it("retire request_daily_brief quand missionId est présent", () => {
    const result = applySchedulerIsolation(fullToolset, "mission-123");
    expect(Object.keys(result)).not.toContain("request_daily_brief");
  });

  it("retire run_mission quand missionId est présent", () => {
    const result = applySchedulerIsolation(fullToolset, "mission-123");
    expect(Object.keys(result)).not.toContain("run_mission");
  });

  it("retire request_connection quand missionId est présent", () => {
    const result = applySchedulerIsolation(fullToolset, "mission-123");
    expect(Object.keys(result)).not.toContain("request_connection");
  });

  it("conserve les tools non-récursifs (get_messages, search_web, generate_report)", () => {
    const result = applySchedulerIsolation(fullToolset, "mission-123");
    expect(Object.keys(result)).toContain("get_messages");
    expect(Object.keys(result)).toContain("search_web");
    expect(Object.keys(result)).toContain("generate_report");
  });

  it("ne retire rien si missionId est absent", () => {
    const result = applySchedulerIsolation(fullToolset, undefined);
    expect(Object.keys(result)).toHaveLength(Object.keys(fullToolset).length);
  });
});
