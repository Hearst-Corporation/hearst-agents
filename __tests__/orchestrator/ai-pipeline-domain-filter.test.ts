/**
 * AI Pipeline — domain filter integration tests.
 *
 * Verifies that runAiPipeline routes the resolved capability domain through
 * filterToolsByDomain before passing tools to toAiTools / buildAgentSystemPrompt.
 *
 * The streamText / Anthropic / engine layers are mocked aggressively — this
 * test cares only about which tools survive the domain filter.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DiscoveredTool } from "@/lib/connectors/composio/discovery";

const allTools: DiscoveredTool[] = [
  { name: "GMAIL_FETCH_EMAILS", app: "gmail", description: "fetch", parameters: {} },
  { name: "GMAIL_SEND_EMAIL", app: "gmail", description: "send", parameters: {} },
  { name: "GITHUB_CREATE_ISSUE", app: "github", description: "issue", parameters: {} },
  { name: "SLACK_SEND_MESSAGE", app: "slack", description: "msg", parameters: {} },
];

const {
  getToolsForUser,
  toAiTools,
  buildAgentSystemPrompt,
  streamText,
  createAnthropic,
  buildNativeGoogleTools,
} = vi.hoisted(() => ({
  getToolsForUser: vi.fn(),
  toAiTools: vi.fn(),
  buildAgentSystemPrompt: vi.fn(),
  streamText: vi.fn(),
  createAnthropic: vi.fn(),
  buildNativeGoogleTools: vi.fn(),
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

vi.mock("@/lib/tools/native/google", () => ({
  buildNativeGoogleTools,
  NATIVE_GOOGLE_TOOL_DESCRIPTORS: [
    { name: "gmail_fetch_emails", description: "Fetch Gmail emails" },
    { name: "gmail_send_email", description: "Send Gmail email" },
  ],
}));

vi.mock("@ai-sdk/anthropic", () => ({
  createAnthropic: createAnthropic.mockReturnValue(
    // returns a model factory that accepts a model name and returns a stub
    () => ({ modelId: "stub" }),
  ),
}));

vi.mock("ai", async (importOriginal) => {
  // Keep jsonSchema + stepCountIs real; only stub streamText.
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
  return {
    emit: vi.fn(),
  } as unknown as RunEventBus;
}

function makeStreamResult() {
  return {
    fullStream: (async function* () {
      // No events — pipeline just resolves cleanly.
    })(),
    usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
  };
}

describe("runAiPipeline — domain filter", () => {
  beforeEach(() => {
    getToolsForUser.mockReset();
    toAiTools.mockReset();
    buildAgentSystemPrompt.mockReset();
    streamText.mockReset();

    getToolsForUser.mockResolvedValue(allTools);
    buildNativeGoogleTools.mockResolvedValue({});
    toAiTools.mockReturnValue({});
    buildAgentSystemPrompt.mockReturnValue("system prompt");
    streamText.mockReturnValue(makeStreamResult());
  });

  it("domain=communication → toAiTools receives only gmail + slack", async () => {
    await runAiPipeline(makeEngine(), makeBus(), {
      userId: "u1",
      tenantId: "t1",
      workspaceId: "ws1",
      message: "envoyer un email",
      domain: "communication",
    });
    expect(toAiTools).toHaveBeenCalledTimes(1);
    const passedTools = toAiTools.mock.calls[0][0] as DiscoveredTool[];
    const apps = [...new Set(passedTools.map((t) => t.app))].sort();
    expect(apps).toEqual(["gmail", "slack"]);
    expect(apps).not.toContain("github");
  });

  it("préserve les slugs Composio réels après intersection _allowedTools", async () => {
    toAiTools.mockReturnValue({
      SLACK_SEND_MESSAGE: {
        inputSchema: {},
        execute: vi.fn(),
      },
    });

    await runAiPipeline(makeEngine(), makeBus(), {
      userId: "u1",
      tenantId: "t1",
      workspaceId: "ws1",
      message: "liste mes emails",
      domain: "communication",
      _allowedTools: ["get_messages", "send_message"],
    });

    const streamArgs = streamText.mock.calls[0][0] as { tools: Record<string, unknown> };
    expect(streamArgs.tools).toHaveProperty("SLACK_SEND_MESSAGE");
    expect(streamArgs.tools).not.toHaveProperty("GITHUB_CREATE_ISSUE");
  });

  it("mappe les noms génériques vers les slugs runtime natifs critiques", async () => {
    buildNativeGoogleTools.mockResolvedValue({
      gmail_fetch_emails: {
        inputSchema: {},
        execute: vi.fn(),
      },
    });

    await runAiPipeline(makeEngine(), makeBus(), {
      userId: "u1",
      tenantId: "t1",
      workspaceId: "ws1",
      message: "liste mes emails et cherche sur le web",
      domain: "communication",
      _allowedTools: ["get_messages", "search_web", "schedule_task"],
    });

    const streamArgs = streamText.mock.calls[0][0] as { tools: Record<string, unknown> };
    expect(streamArgs.tools).toHaveProperty("gmail_fetch_emails");
    expect(streamArgs.tools).toHaveProperty("web_search");
    expect(streamArgs.tools).toHaveProperty("create_scheduled_mission");
    expect(streamArgs.tools).toHaveProperty("request_connection");
  });

  it("domain=developer → toAiTools receives only github", async () => {
    await runAiPipeline(makeEngine(), makeBus(), {
      userId: "u1",
      tenantId: "t1",
      workspaceId: "ws1",
      message: "create issue",
      domain: "developer",
    });
    const passedTools = toAiTools.mock.calls[0][0] as DiscoveredTool[];
    const apps = passedTools.map((t) => t.app);
    expect(apps).toEqual(["github"]);
  });

  it("domain=general → toAiTools receives all tools", async () => {
    await runAiPipeline(makeEngine(), makeBus(), {
      userId: "u1",
      tenantId: "t1",
      workspaceId: "ws1",
      message: "general question",
      domain: "general",
    });
    const passedTools = toAiTools.mock.calls[0][0] as DiscoveredTool[];
    expect(passedTools).toHaveLength(allTools.length);
  });

  it("domain undefined → treated as general → all tools", async () => {
    await runAiPipeline(makeEngine(), makeBus(), {
      userId: "u1",
      tenantId: "t1",
      workspaceId: "ws1",
      message: "general question",
      // no domain
    });
    const passedTools = toAiTools.mock.calls[0][0] as DiscoveredTool[];
    expect(passedTools).toHaveLength(allTools.length);
  });

  it("buildAgentSystemPrompt receives the FILTERED tools (not the raw set)", async () => {
    await runAiPipeline(makeEngine(), makeBus(), {
      userId: "u1",
      tenantId: "t1",
      workspaceId: "ws1",
      message: "send slack",
      domain: "communication",
    });
    const args = buildAgentSystemPrompt.mock.calls[0][0];
    const apps = [...new Set((args.composioTools as DiscoveredTool[]).map((t) => t.app))].sort();
    expect(apps).toEqual(["gmail", "slack"]);
  });
});
