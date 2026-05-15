import { beforeEach, describe, expect, it } from "vitest";
import { defaultCircuitBreaker } from "@/lib/llm/circuit-breaker";

describe("Circuit breaker per-tenant", () => {
  beforeEach(() => {
    // Reset breaker state before each test
    // Note: in real tests, you'd need a way to reset the private state
  });

  it("user A trip ne block pas user B", () => {
    const provider = "anthropic";
    const tenantA = "tenant-a";
    const tenantB = "tenant-b";

    // Trip breaker for tenantA
    for (let i = 0; i < 6; i++) {
      defaultCircuitBreaker.recordFailure(provider, new Error("500 error"), tenantA);
    }

    // Check: tenantA breaker is OPEN
    expect(defaultCircuitBreaker.isOpen(provider, tenantA)).toBe(true);

    // Check: tenantB breaker is CLOSED (independent)
    expect(defaultCircuitBreaker.isOpen(provider, tenantB)).toBe(false);
  });

  it("4xx ne trip pas le breaker", () => {
    const provider = "openai";
    const tenantId = "test-tenant";

    // Record 10 4xx errors
    for (let i = 0; i < 10; i++) {
      defaultCircuitBreaker.recordFailure(provider, new Error("400 bad request"), tenantId);
    }

    // Breaker should still be CLOSED
    expect(defaultCircuitBreaker.isOpen(provider, tenantId)).toBe(false);
  });

  it("5xx errors trip the breaker after threshold", () => {
    const provider = "gemini";
    const tenantId = "test-tenant-2";

    // Record 5 5xx errors (threshold = 5)
    for (let i = 0; i < 5; i++) {
      defaultCircuitBreaker.recordFailure(provider, new Error("503 service unavailable"), tenantId);
    }

    // Breaker should be OPEN
    expect(defaultCircuitBreaker.isOpen(provider, tenantId)).toBe(true);
  });

  it("recordSuccess resets failure count", () => {
    const provider = "anthropic";
    const tenantId = "test-tenant-3";

    // Record 3 failures
    for (let i = 0; i < 3; i++) {
      defaultCircuitBreaker.recordFailure(provider, new Error("500 error"), tenantId);
    }

    // Verify in CLOSED state but with failures tracked
    expect(defaultCircuitBreaker.isOpen(provider, tenantId)).toBe(false);

    // Record success
    defaultCircuitBreaker.recordSuccess(provider, tenantId);

    // Failure count should reset
    const snapshot = defaultCircuitBreaker.getProviderSnapshot(provider, tenantId);
    expect(snapshot.state).toBe("CLOSED");
    expect(snapshot.failures).toBe(0);
  });

  it("provider without tenantId (backward compat) uses provider key alone", () => {
    const provider = "composer";

    // Record failures without tenantId
    for (let i = 0; i < 6; i++) {
      defaultCircuitBreaker.recordFailure(provider, new Error("500 error"));
    }

    // Should be OPEN
    expect(defaultCircuitBreaker.isOpen(provider)).toBe(true);
  });
});
