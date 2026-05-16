/**
 * F002 — run-research-report.ts : vérifie que getProvider("kimi") est appelé
 * dans synthesizeReport et que le circuit breaker est câblé.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks hoistés ──────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  chatMock: vi.fn(),
  isOpen: vi.fn().mockReturnValue(false),
  recordSuccess: vi.fn(),
  recordFailure: vi.fn(),
  storeAssetMock: vi.fn(),
  searchWebMock: vi.fn(),
  generatePdfMock: vi.fn(),
}));

vi.mock("@/lib/llm/router", () => ({
  getProvider: (_name: string) => ({
    chat: mocks.chatMock,
    name: _name,
  }),
}));

vi.mock("@/lib/llm/circuit-breaker", () => ({
  defaultCircuitBreaker: {
    isOpen: mocks.isOpen,
    recordSuccess: mocks.recordSuccess,
    recordFailure: mocks.recordFailure,
  },
}));

vi.mock("@/lib/llm/metrics", () => ({
  defaultMetrics: { recordCall: vi.fn(), recordError: vi.fn(), incrementCounter: vi.fn() },
}));

vi.mock("@/lib/assets/types", async () => {
  const actual = await vi.importActual<typeof import("@/lib/assets/types")>("@/lib/assets/types");
  return { ...actual, storeAsset: mocks.storeAssetMock };
});

vi.mock("@/lib/tools/handlers/web-search", () => ({
  searchWeb: (q: string) => mocks.searchWebMock(q),
}));

vi.mock("@/lib/engine/runtime/assets/generators/pdf", () => ({
  generatePdfArtifact: (input: Record<string, unknown>) => mocks.generatePdfMock(input),
}));

import { runResearchReport } from "@/lib/engine/orchestrator/run-research-report";
import type { RunEngine } from "@/lib/engine/runtime/engine";
import type { RunEventBus } from "@/lib/events/bus";

const kimiSynthResponse = {
  content: "# Rapport\n\nContenu de synthèse détaillé sur le sujet demandé.",
  tokens_in: 500,
  tokens_out: 300,
  latency_ms: 800,
  model: "kimi-k2.5",
  provider: "kimi",
  cost_usd: 0,
};

function makeEngine(id = "run-research-f002"): RunEngine {
  return {
    id,
    complete: vi.fn().mockResolvedValue(undefined),
    fail: vi.fn().mockResolvedValue(undefined),
  } as unknown as RunEngine;
}

function makeEventBus(): RunEventBus {
  return { emit: vi.fn() } as unknown as RunEventBus;
}

describe("F002 — run-research-report getProvider wiring", () => {
  beforeEach(() => {
    mocks.chatMock.mockReset().mockResolvedValue(kimiSynthResponse);
    mocks.isOpen.mockReset().mockReturnValue(false);
    mocks.recordSuccess.mockReset();
    mocks.recordFailure.mockReset();
    mocks.storeAssetMock.mockReset();
    mocks.searchWebMock.mockReset();
    mocks.generatePdfMock.mockReset().mockResolvedValue(null);
    process.env.KIMI_API_KEY = "sk-test";

    // Search returns short summary to force LLM synthesis path
    mocks.searchWebMock.mockResolvedValue({
      results: [{ title: "Source", url: "https://example.com", snippet: "extrait" }],
      summary: "court",
    });
  });

  it("appelle getProvider(kimi).chat() pour la synthèse du rapport", async () => {
    const engine = makeEngine();
    const bus = makeEventBus();

    await runResearchReport({
      message: "fais-moi un rapport sur les LLMs",
      engine,
      eventBus: bus,
      scope: { tenantId: "t1", workspaceId: "w1", userId: "u1" },
      threadId: "th1",
    });

    expect(mocks.chatMock).toHaveBeenCalledTimes(1);
    expect(mocks.chatMock).toHaveBeenCalledWith(
      expect.objectContaining({ model: expect.any(String) }),
    );
  });

  it("appelle recordSuccess après une synthèse réussie", async () => {
    const engine = makeEngine();
    const bus = makeEventBus();

    await runResearchReport({
      message: "fais-moi un rapport sur les LLMs",
      engine,
      eventBus: bus,
      scope: { tenantId: "t1", workspaceId: "w1", userId: "u1" },
    });

    // Helper chatWithCircuitBreaker passe (provider, tenantId) — tenantId undefined
    // ici car synthesizeReport ne propage pas le scope.tenantId au breaker (legacy).
    expect(mocks.recordSuccess).toHaveBeenCalledWith("kimi", undefined);
  });

  it("lève une erreur si le breaker est ouvert (synthesis annulée)", async () => {
    mocks.isOpen.mockReturnValue(true);
    const engine = makeEngine();
    const bus = makeEventBus();

    // La search est OK mais la synthesis lève une erreur car breaker ouvert
    // → synthesizeReport throw → runResearchReport attrape et fallback sur summary
    await runResearchReport({
      message: "rapport sur blockchain",
      engine,
      eventBus: bus,
      scope: { tenantId: "t1", workspaceId: "w1", userId: "u1" },
    });

    // Le run doit se compléter (fallback sur searchResult.summary) — engine.fail non appelé
    expect(engine.fail).not.toHaveBeenCalled();
    expect(mocks.chatMock).not.toHaveBeenCalled();
  });

  it("appelle recordFailure si getProvider().chat() lève une erreur", async () => {
    mocks.chatMock.mockRejectedValue(new Error("API down"));
    const engine = makeEngine();
    const bus = makeEventBus();

    // synthesizeReport throw → catch dans runResearchReport → fallback summary
    await runResearchReport({
      message: "rapport sur X",
      engine,
      eventBus: bus,
      scope: { tenantId: "t2", workspaceId: "w1", userId: "u1" },
    });

    expect(mocks.recordFailure).toHaveBeenCalledWith("kimi", expect.any(Error), undefined);
  });
});
