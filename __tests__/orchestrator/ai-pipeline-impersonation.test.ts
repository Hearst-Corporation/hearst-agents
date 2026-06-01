/**
 * AI Pipeline — impersonation Hive (composioEntityId).
 *
 * Vérifie que runAiPipeline route le bon entity Composio :
 *  - composioEntityId présent (hive:<tenant>) → getToolsForUser ET toAiTools
 *    sont appelés avec cet entity, PAS avec userId.
 *  - composioEntityId absent (user Helm natif) → fallback strict sur userId.
 *
 * Les couches streamText / Anthropic / engine sont mockées agressivement —
 * ce test ne s'intéresse qu'à l'entity passé aux deux call-sites Composio.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DiscoveredTool } from "@/lib/connectors/composio/discovery";

const allTools: DiscoveredTool[] = [
  { name: "SLACK_SEND_MESSAGE", app: "slack", description: "msg", parameters: {} },
];

const { getToolsForUser, toAiTools, buildAgentSystemPrompt, streamText, createAnthropic } =
  vi.hoisted(() => ({
    getToolsForUser: vi.fn(),
    toAiTools: vi.fn(),
    buildAgentSystemPrompt: vi.fn(),
    streamText: vi.fn(),
    createAnthropic: vi.fn(),
  }));

vi.mock("@/lib/connectors/composio/discovery", () => ({
  getToolsForUser,
}));

vi.mock("@/lib/connectors/composio/to-ai-tools", () => ({
  toAiTools,
}));

vi.mock("@/lib/engine/orchestrator/system-prompt", () => ({
  buildAgentSystemPrompt,
  ORCHESTRATOR_MODEL: "kimi-k2.5",
}));

vi.mock("@ai-sdk/anthropic", () => ({
  createAnthropic: createAnthropic.mockReturnValue(() => ({ modelId: "stub" })),
}));

vi.mock("ai", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    streamText,
  };
});

import { runAiPipeline } from "@/lib/engine/orchestrator/ai-pipeline";
import type { RunEngine } from "@/lib/engine/runtime/engine";
import type { RunEventBus } from "@/lib/events/bus";

function makeEngine(): RunEngine {
  return {
    id: "run-test",
    cost: { track: vi.fn().mockResolvedValue(undefined) },
    complete: vi.fn().mockResolvedValue(undefined),
    fail: vi.fn().mockResolvedValue(undefined),
  } as unknown as RunEngine;
}

function makeBus(): RunEventBus {
  return { emit: vi.fn() } as unknown as RunEventBus;
}

function makeStreamResult() {
  return {
    fullStream: (async function* () {
      // No events — pipeline resolves cleanly.
    })(),
    usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
  };
}

function makeStreamResultWithEvents(events: unknown[]) {
  return {
    fullStream: (async function* () {
      for (const event of events) yield event;
    })(),
    usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
  };
}

const HELM_USER_ID = "helm-user-1";
const HIVE_TENANT_ID = "99999999-8888-7777-6666-555555555555";
const HIVE_ENTITY = `hive:${HIVE_TENANT_ID}`;

describe("runAiPipeline — impersonation Hive (composioEntityId)", () => {
  beforeEach(() => {
    getToolsForUser.mockReset();
    toAiTools.mockReset();
    buildAgentSystemPrompt.mockReset();
    streamText.mockReset();

    getToolsForUser.mockResolvedValue(allTools);
    toAiTools.mockReturnValue({});
    buildAgentSystemPrompt.mockReturnValue("system prompt");
    streamText.mockReturnValue(makeStreamResult());
  });

  it("composioEntityId présent → getToolsForUser ET toAiTools reçoivent l'entity Hive", async () => {
    await runAiPipeline(makeEngine(), makeBus(), {
      userId: HELM_USER_ID,
      tenantId: HIVE_TENANT_ID,
      workspaceId: HIVE_TENANT_ID,
      message: "envoyer un slack",
      domain: "general",
      composioEntityId: HIVE_ENTITY,
    });

    // Discovery scopée sur l'entity Hive, pas sur le userId du service principal.
    expect(getToolsForUser).toHaveBeenCalledWith(HIVE_ENTITY);
    expect(getToolsForUser).not.toHaveBeenCalledWith(HELM_USER_ID);

    // Exécution (toAiTools) scopée sur l'entity Hive également.
    expect(toAiTools).toHaveBeenCalledTimes(1);
    const ctx = toAiTools.mock.calls[0][1] as { userId: string; tenantId: string };
    expect(ctx.userId).toBe(HIVE_ENTITY);
    expect(ctx.tenantId).toBe(HIVE_TENANT_ID);
  });

  it("composioEntityId absent (user natif) → fallback strict sur userId", async () => {
    await runAiPipeline(makeEngine(), makeBus(), {
      userId: HELM_USER_ID,
      tenantId: "t1",
      workspaceId: "ws1",
      message: "envoyer un slack",
      domain: "general",
      // pas de composioEntityId
    });

    expect(getToolsForUser).toHaveBeenCalledWith(HELM_USER_ID);
    const ctx = toAiTools.mock.calls[0][1] as { userId: string; tenantId: string };
    expect(ctx.userId).toBe(HELM_USER_ID);
  });

  it("tool-error après tool-call émet tool_call_failed", async () => {
    const bus = makeBus();
    streamText.mockReturnValue(
      makeStreamResultWithEvents([
        {
          type: "tool-call",
          toolCallId: "call-gmail",
          toolName: "GMAIL_FETCH_EMAILS",
          input: {},
        },
        {
          type: "tool-error",
          toolCallId: "call-gmail",
          toolName: "GMAIL_FETCH_EMAILS",
          input: {},
          error: new Error("composio timeout"),
        },
      ]),
    );

    await runAiPipeline(makeEngine(), bus, {
      userId: HELM_USER_ID,
      tenantId: HIVE_TENANT_ID,
      workspaceId: HIVE_TENANT_ID,
      message: "Liste mes emails Gmail",
      domain: "communication",
      composioEntityId: HIVE_ENTITY,
    });

    expect(bus.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "tool_call_started",
        step_id: "call-gmail",
        tool: "GMAIL_FETCH_EMAILS",
      }),
    );
    expect(bus.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "tool_call_failed",
        step_id: "call-gmail",
        tool: "GMAIL_FETCH_EMAILS",
        error: "composio timeout",
      }),
    );
  });
});
