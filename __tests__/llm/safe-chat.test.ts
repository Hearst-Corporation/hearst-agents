import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const isOpenMock = vi.fn();
const recordSuccessMock = vi.fn();
const recordFailureMock = vi.fn();
const chatMock = vi.fn();
const getProviderMock = vi.fn((_name: string) => ({ name: "kimi", chat: chatMock }));

vi.mock("@/lib/llm/circuit-breaker", () => ({
  defaultCircuitBreaker: {
    isOpen: (provider: string, tenantId?: string) => isOpenMock(provider, tenantId),
    recordSuccess: (provider: string, tenantId?: string) => recordSuccessMock(provider, tenantId),
    recordFailure: (provider: string, err: Error, tenantId?: string) =>
      recordFailureMock(provider, err, tenantId),
  },
}));

vi.mock("@/lib/llm/router", () => ({
  getProvider: (name: string) => getProviderMock(name),
}));

vi.mock("@/lib/observability/logger", () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { chatWithCircuitBreaker } from "@/lib/llm/safe-chat";

describe("chatWithCircuitBreaker", () => {
  beforeEach(() => {
    isOpenMock.mockReset();
    recordSuccessMock.mockReset();
    recordFailureMock.mockReset();
    chatMock.mockReset();
    getProviderMock.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns fallback and skips LLM call when circuit breaker is open", async () => {
    isOpenMock.mockReturnValue(true);

    const result = await chatWithCircuitBreaker({
      tenantId: "tenant-1",
      context: "test/open",
      chatRequest: {
        model: "kimi-k2.5",
        max_tokens: 100,
        messages: [{ role: "user", content: "ping" }],
      },
      fallback: "FALLBACK",
      parse: (res) => res.content,
    });

    expect(result).toBe("FALLBACK");
    expect(chatMock).not.toHaveBeenCalled();
    expect(recordSuccessMock).not.toHaveBeenCalled();
    expect(recordFailureMock).not.toHaveBeenCalled();
    expect(isOpenMock).toHaveBeenCalledWith("kimi", "tenant-1");
  });

  it("returns parsed response on success and records success", async () => {
    isOpenMock.mockReturnValue(false);
    chatMock.mockResolvedValue({
      content: "hello world",
      model: "kimi-k2.5",
      provider: "kimi",
      tokens_in: 10,
      tokens_out: 5,
      cost_usd: 0,
      latency_ms: 42,
    });

    const result = await chatWithCircuitBreaker({
      tenantId: "tenant-1",
      context: "test/success",
      chatRequest: {
        model: "kimi-k2.5",
        max_tokens: 100,
        messages: [{ role: "user", content: "ping" }],
      },
      fallback: "FALLBACK",
      parse: (res) => res.content.toUpperCase(),
    });

    expect(result).toBe("HELLO WORLD");
    expect(chatMock).toHaveBeenCalledTimes(1);
    expect(recordSuccessMock).toHaveBeenCalledWith("kimi", "tenant-1");
    expect(recordFailureMock).not.toHaveBeenCalled();
  });

  it("returns fallback and records failure when provider throws", async () => {
    isOpenMock.mockReturnValue(false);
    const err = new Error("500 server error");
    chatMock.mockRejectedValue(err);

    const result = await chatWithCircuitBreaker({
      tenantId: "tenant-1",
      context: "test/failure",
      chatRequest: {
        model: "kimi-k2.5",
        max_tokens: 100,
        messages: [{ role: "user", content: "ping" }],
      },
      fallback: null,
      parse: (res) => res.content,
    });

    expect(result).toBeNull();
    expect(recordFailureMock).toHaveBeenCalledWith("kimi", err, "tenant-1");
    expect(recordSuccessMock).not.toHaveBeenCalled();
  });

  it("uses default provider 'kimi' when none specified", async () => {
    isOpenMock.mockReturnValue(false);
    chatMock.mockResolvedValue({
      content: "ok",
      model: "kimi-k2.5",
      provider: "kimi",
      tokens_in: 1,
      tokens_out: 1,
      cost_usd: 0,
      latency_ms: 1,
    });

    await chatWithCircuitBreaker({
      context: "test/default-provider",
      chatRequest: {
        model: "kimi-k2.5",
        max_tokens: 10,
        messages: [{ role: "user", content: "ping" }],
      },
      fallback: "",
      parse: (res) => res.content,
    });

    expect(isOpenMock).toHaveBeenCalledWith("kimi", undefined);
    expect(getProviderMock).toHaveBeenCalledWith("kimi");
  });

  it("records failure once (no double-record) when parse() throws after a successful LLM call", async () => {
    isOpenMock.mockReturnValue(false);
    chatMock.mockResolvedValue({
      content: "ok",
      model: "kimi-k2.5",
      provider: "kimi",
      tokens_in: 1,
      tokens_out: 1,
      cost_usd: 0,
      latency_ms: 1,
    });

    const parseErr = new Error("parse_failed");
    const result = await chatWithCircuitBreaker({
      tenantId: "tenant-parse",
      context: "test/parse-throws",
      chatRequest: {
        model: "kimi-k2.5",
        max_tokens: 10,
        messages: [{ role: "user", content: "ping" }],
      },
      fallback: "FB_PARSE",
      parse: () => {
        throw parseErr;
      },
    });

    expect(result).toBe("FB_PARSE");
    // recordSuccess MUST NOT be called when parse throws (success is only
    // recorded after parse resolves) — vérification explicite de l'ordre via
    // invocationCallOrder (la "preuve" qu'il n'y a pas eu de race où
    // recordSuccess serait passé avant le throw du parse).
    expect(recordSuccessMock).not.toHaveBeenCalled();
    expect(recordSuccessMock.mock.invocationCallOrder).toHaveLength(0);
    // recordFailure MUST be called exactly once, with the parse error
    expect(recordFailureMock).toHaveBeenCalledTimes(1);
    expect(recordFailureMock).toHaveBeenCalledWith("kimi", parseErr, "tenant-parse");
    // Et chatMock (le LLM) a bien été invoqué AVANT recordFailure : on
    // confirme la séquence chat → parse(throws) → recordFailure.
    const chatOrder = chatMock.mock.invocationCallOrder[0];
    const failureOrder = recordFailureMock.mock.invocationCallOrder[0];
    expect(chatOrder).toBeDefined();
    expect(failureOrder).toBeDefined();
    expect(chatOrder).toBeLessThan(failureOrder);
  });

  it("wraps non-Error throws via parse failure into Error before recording failure", async () => {
    isOpenMock.mockReturnValue(false);
    chatMock.mockRejectedValue("plain string error");

    const result = await chatWithCircuitBreaker({
      tenantId: "tenant-x",
      context: "test/non-error",
      chatRequest: {
        model: "kimi-k2.5",
        max_tokens: 10,
        messages: [{ role: "user", content: "ping" }],
      },
      fallback: "FB",
      parse: (res) => res.content,
    });

    expect(result).toBe("FB");
    expect(recordFailureMock).toHaveBeenCalledTimes(1);
    const callArgs = recordFailureMock.mock.calls[0];
    expect(callArgs[0]).toBe("kimi");
    expect(callArgs[1]).toBeInstanceOf(Error);
    expect((callArgs[1] as Error).message).toContain("plain string error");
    expect(callArgs[2]).toBe("tenant-x");
  });
});
