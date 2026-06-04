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
  createOpenAI,
  buildNativeGoogleTools,
} = vi.hoisted(() => ({
  getToolsForUser: vi.fn(),
  toAiTools: vi.fn(),
  buildAgentSystemPrompt: vi.fn(),
  streamText: vi.fn(),
  createOpenAI: vi.fn(),
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
  ORCHESTRATOR_MODEL_OAI: "kimi-k2.6",
}));

vi.mock("@/lib/tools/native/google", () => ({
  buildNativeGoogleTools,
  NATIVE_GOOGLE_TOOL_DESCRIPTORS: [
    { name: "gmail_fetch_emails", description: "Fetch Gmail emails" },
    { name: "gmail_send_email", description: "Send Gmail email" },
  ],
}));

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: createOpenAI.mockReturnValue(
    // returns a provider whose .chat(model) yields a stub language model
    { chat: () => ({ modelId: "stub" }) },
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

  it("source cortex + allowlist vide => tools natifs Helm bloqués, Composio domain-filtered survivent", async () => {
    // _allowedTools=[] bloque tous les tools natifs Helm.
    // Les Composio déjà gated par filterToolsByDomain passent quand même :
    // leurs slugs uppercase ne sont pas dans CAPABILITY_TO_HELM_TOOLS et ne
    // peuvent pas être listés dans _allowedTools par Cortex.
    toAiTools.mockReturnValue({
      SLACK_SEND_MESSAGE: {
        inputSchema: {},
        execute: vi.fn(),
      },
    });
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
      message: "teste",
      domain: "general",
      _allowedToolsSource: "cortex",
      _allowedTools: [],
    });

    const streamArgs = streamText.mock.calls[0][0] as { tools: Record<string, unknown> };
    // Native Helm tool non listé → absent.
    expect(streamArgs.tools).not.toHaveProperty("gmail_fetch_emails");
    // Composio domain-filtered → présent même si _allowedTools est vide.
    expect(streamArgs.tools).toHaveProperty("SLACK_SEND_MESSAGE");
  });

  it("source cortex + cortex_search => cortex_search autorisé + Composio domain-filtered survivent", async () => {
    // SLACK_SEND_MESSAGE est un tool Composio qui a passé filterToolsByDomain (domain=general).
    // Avec la policy Cortex, les tools natifs Helm sont contrôlés par _allowedTools,
    // MAIS les Composio déjà gated en amont par filterToolsByDomain ne doivent PAS
    // être ré-évincés (leurs slugs uppercase ne figurent pas dans CAPABILITY_TO_HELM_TOOLS).
    toAiTools.mockReturnValue({
      SLACK_SEND_MESSAGE: {
        inputSchema: {},
        execute: vi.fn(),
      },
    });
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
      message: "cherche dans ma mémoire",
      domain: "general",
      _allowedToolsSource: "cortex",
      _allowedTools: ["cortex_search"],
    });

    const streamArgs = streamText.mock.calls[0][0] as { tools: Record<string, unknown> };
    // Native Helm tool explicitement autorisé → présent.
    expect(streamArgs.tools).toHaveProperty("cortex_search");
    // Native Google tool non listé dans _allowedTools → absent (contrôlé par Cortex).
    expect(streamArgs.tools).not.toHaveProperty("gmail_fetch_emails");
    // Composio tool domain-filtered → présent (gating Composio = domain filter, pas Cortex).
    expect(streamArgs.tools).toHaveProperty("SLACK_SEND_MESSAGE");
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
    // Les tools natifs Hearst (app:"hearst") sont volontairement ajoutés au
    // descripteur du prompt (cf nativeHearstForPrompt dans ai-pipeline) pour que
    // le modèle connaisse leur existence. Le filtrage par DOMAINE ne concerne que
    // les tools Composio → on les isole pour l'assertion.
    const composioApps = [
      ...new Set(
        (args.composioTools as DiscoveredTool[])
          .map((t) => t.app)
          .filter((app) => app !== "hearst"),
      ),
    ].sort();
    expect(composioApps).toEqual(["gmail", "slack"]);
  });
});
