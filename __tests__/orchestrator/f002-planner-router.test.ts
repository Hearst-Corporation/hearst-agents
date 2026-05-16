/**
 * F002 — planner.ts : vérifie que getProvider("kimi") est appelé
 * et que les hooks circuit breaker sont correctement câblés.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks hoistés ──────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  chatMock: vi.fn(),
  isOpen: vi.fn().mockReturnValue(false),
  recordSuccess: vi.fn(),
  recordFailure: vi.fn(),
  createPlanSpy: vi.fn(),
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

vi.mock("@/lib/engine/runtime/plans/store", () => ({
  PlanStore: class {
    createPlan = mocks.createPlanSpy;
  },
}));

import { planFromIntent } from "@/lib/engine/orchestrator/planner";
import type { RunEngine } from "@/lib/engine/runtime/engine";

function fakeEngine(): RunEngine {
  return {
    id: "run-planner-f002",
    cost: { track: vi.fn().mockResolvedValue(undefined) },
    attachPlanId: vi.fn().mockResolvedValue(undefined),
  } as unknown as RunEngine;
}

// Réponse simulant un text_response de Kimi (JSON structuré)
const kimiTextResponse = {
  content: JSON.stringify({
    tool_calls: [
      {
        function: {
          name: "text_response",
          arguments: JSON.stringify({ text: "Réponse directe test" }),
        },
      },
    ],
  }),
  tokens_in: 100,
  tokens_out: 50,
  latency_ms: 200,
  model: "kimi-k2.5",
  provider: "kimi",
  cost_usd: 0,
};

describe("F002 — planner getProvider wiring", () => {
  beforeEach(() => {
    mocks.chatMock.mockReset().mockResolvedValue(kimiTextResponse);
    mocks.isOpen.mockReset().mockReturnValue(false);
    mocks.recordSuccess.mockReset();
    mocks.recordFailure.mockReset();
    process.env.KIMI_API_KEY = "sk-test";
  });

  it("appelle getProvider(kimi).chat() pour résoudre l'intent", async () => {
    const result = await planFromIntent({} as never, fakeEngine(), "bonjour", [], {
      tenantId: "tenant-x",
    });

    expect(mocks.chatMock).toHaveBeenCalledTimes(1);
    expect(mocks.chatMock).toHaveBeenCalledWith(
      expect.objectContaining({ model: expect.any(String) }),
    );
    expect(result.kind).toBe("direct_response");
  });

  it("retourne kind=error immédiatement si le breaker est ouvert", async () => {
    mocks.isOpen.mockReturnValue(true);

    const result = await planFromIntent({} as never, fakeEngine(), "hello", [], {
      tenantId: "tenant-open",
    });

    expect(result.kind).toBe("error");
    expect(mocks.chatMock).not.toHaveBeenCalled();
  });

  it("appelle recordSuccess après un appel LLM réussi", async () => {
    await planFromIntent({} as never, fakeEngine(), "test", [], { tenantId: "t1" });

    expect(mocks.recordSuccess).toHaveBeenCalledWith("kimi", "t1");
  });

  it("appelle recordFailure si getProvider().chat() lève une erreur", async () => {
    mocks.chatMock.mockRejectedValue(new Error("LLM timeout"));

    const result = await planFromIntent({} as never, fakeEngine(), "test", [], {
      tenantId: "tenant-fail",
    });

    expect(result.kind).toBe("error");
    expect(mocks.recordFailure).toHaveBeenCalledWith("kimi", expect.any(Error), "tenant-fail");
  });

  it("propage le tenantId au circuit breaker (Phase 5)", async () => {
    await planFromIntent({} as never, fakeEngine(), "test", [], { tenantId: "tenant-phase5" });

    expect(mocks.isOpen).toHaveBeenCalledWith("kimi", "tenant-phase5");
  });
});
