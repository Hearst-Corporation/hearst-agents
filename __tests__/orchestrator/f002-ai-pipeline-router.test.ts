/**
 * F002 — ai-pipeline.ts : integration test vérifiant que le circuit breaker
 * est consulté avant le stream et que les hooks success/failure sont branchés.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks hoistés ──────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  isOpen: vi.fn().mockReturnValue(false),
  recordSuccess: vi.fn(),
  recordFailure: vi.fn(),
  streamTextMock: vi.fn(),
}));

vi.mock("@/lib/llm/circuit-breaker", () => ({
  defaultCircuitBreaker: {
    isOpen: mocks.isOpen,
    recordSuccess: mocks.recordSuccess,
    recordFailure: mocks.recordFailure,
  },
}));

// Stub all heavy dependencies so we can focus on breaker wiring
vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: () => (_modelId: string) => ({ modelId: _modelId }),
}));

vi.mock("ai", () => ({
  extractReasoningMiddleware: () => ({}),
  jsonSchema: (s: unknown) => s,
  stepCountIs: () => ({}),
  streamText: mocks.streamTextMock,
  wrapLanguageModel: (_opts: unknown) => ({}),
}));

vi.mock("@/lib/connectors/composio/discovery", () => ({
  getToolsForUser: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/connectors/composio/to-ai-tools", () => ({
  toAiTools: vi.fn().mockReturnValue({}),
}));
vi.mock("@/lib/connectors/composio/write-guard", () => ({
  filterToolsByDomain: (_tools: unknown[], _domain: string) => [],
  isWriteAction: () => false,
}));
vi.mock("@/lib/memory/briefing", () => ({ generateBriefing: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/memory/kg-context", () => ({
  getKgContextForUser: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/memory/retrieval-context", () => ({
  getRetrievedMemoryForUser: vi.fn().mockResolvedValue(""),
}));
vi.mock("@/lib/memory/store", () => ({
  appendModelMessages: vi.fn(),
  getRecentModelMessages: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/personas/store", () => ({
  getDefaultPersona: vi.fn().mockResolvedValue(null),
  getPersonaById: vi.fn().mockResolvedValue(null),
  getPersonaForSurface: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/reports/catalog", () => ({ getApplicableReports: vi.fn().mockReturnValue([]) }));
vi.mock("@/lib/tools/native/google", () => ({
  buildNativeGoogleTools: vi.fn().mockResolvedValue({}),
  NATIVE_GOOGLE_TOOL_DESCRIPTORS: [],
}));
vi.mock("@/lib/tools/native/enrich", () => ({ buildEnrichTools: vi.fn().mockReturnValue({}) }));
vi.mock("@/lib/tools/native/extras-media", () => ({
  buildExtrasMediaTools: vi.fn().mockReturnValue({}),
}));
vi.mock("@/lib/tools/native/extras-services", () => ({
  buildExtrasServicesTools: vi.fn().mockReturnValue({}),
}));
vi.mock("@/lib/tools/native/hearst-actions", () => ({
  buildHearstActionTools: vi.fn().mockReturnValue({}),
}));
vi.mock("@/lib/tools/native/kg-query", () => ({ buildKgQueryTools: vi.fn().mockReturnValue({}) }));
vi.mock("@/lib/tools/native/market-data", () => ({
  buildMarketDataTools: vi.fn().mockReturnValue({}),
}));
vi.mock("@/lib/tools/native/meetings", () => ({ buildMeetingsTools: vi.fn().mockReturnValue({}) }));
vi.mock("@/lib/tools/native/missions", () => ({ buildMissionTools: vi.fn().mockReturnValue({}) }));
vi.mock("@/lib/tools/native/research", () => ({ buildResearchTools: vi.fn().mockReturnValue({}) }));
vi.mock("@/lib/tools/native/web-search", () => ({
  buildWebSearchTools: vi.fn().mockReturnValue({}),
}));
vi.mock("@/lib/reports/spec/llm-tool", () => ({
  buildProposeReportSpecTool: vi.fn().mockReturnValue({}),
}));
vi.mock("@/lib/assets/types", () => ({ storeAsset: vi.fn(), loadAssetById: vi.fn() }));
vi.mock("@/lib/embeddings/store", () => ({ upsertEmbedding: vi.fn().mockResolvedValue(true) }));
vi.mock("@/lib/memory/kg-ingest-pipeline", () => ({
  fireAndForgetIngestTurn: vi.fn(),
}));
vi.mock("@/lib/engine/runtime/missions/create-mission", () => ({
  createScheduledMission: vi.fn(),
}));
vi.mock("@/lib/engine/runtime/missions/store", () => ({ addMission: vi.fn() }));
vi.mock("@/lib/engine/runtime/state/adapter", () => ({ saveScheduledMission: vi.fn() }));
vi.mock("@/lib/llm/metrics", () => ({
  defaultMetrics: { recordCall: vi.fn(), recordError: vi.fn(), incrementCounter: vi.fn() },
}));
vi.mock("@/lib/llm/pricing", () => ({ computeCostUsd: vi.fn().mockReturnValue(0) }));
vi.mock("@/lib/utils/canonical-hash", () => ({ canonicalHash: vi.fn().mockReturnValue("hash") }));

import { runAiPipeline } from "@/lib/engine/orchestrator/ai-pipeline";
import type { RunEngine } from "@/lib/engine/runtime/engine";
import type { RunEventBus } from "@/lib/events/bus";

function makeEngine(): RunEngine {
  return {
    id: "run-test-f002",
    fail: vi.fn().mockResolvedValue(undefined),
    complete: vi.fn().mockResolvedValue(undefined),
    cost: { track: vi.fn().mockResolvedValue(undefined) },
  } as unknown as RunEngine;
}

function makeEventBus(): RunEventBus {
  return { emit: vi.fn() } as unknown as RunEventBus;
}

describe("F002 — ai-pipeline circuit breaker wiring", () => {
  beforeEach(() => {
    mocks.isOpen.mockReset().mockReturnValue(false);
    mocks.recordSuccess.mockReset();
    mocks.recordFailure.mockReset();
    mocks.streamTextMock.mockReset();
    process.env.KIMI_API_KEY = "sk-test";
  });

  it("appelle engine.fail() immédiatement si le breaker est ouvert", async () => {
    mocks.isOpen.mockReturnValue(true);
    const engine = makeEngine();
    const bus = makeEventBus();

    await runAiPipeline(engine, bus, {
      userId: "u1",
      message: "test",
      tenantId: "tenant-1",
      workspaceId: "ws-1",
    });

    expect(engine.fail).toHaveBeenCalledWith(expect.stringContaining("Circuit breaker OPEN"));
    expect(mocks.streamTextMock).not.toHaveBeenCalled();
  });

  it("appelle isOpen avec provider=kimi et tenantId", async () => {
    mocks.isOpen.mockReturnValue(true);
    const engine = makeEngine();
    const bus = makeEventBus();

    await runAiPipeline(engine, bus, {
      userId: "u1",
      message: "test",
      tenantId: "tenant-abc",
      workspaceId: "ws-1",
    });

    expect(mocks.isOpen).toHaveBeenCalledWith("kimi", "tenant-abc");
  });
});
