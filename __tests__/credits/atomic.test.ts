import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRpc } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
}));

vi.mock("@/lib/platform/db/supabase", () => ({
  getServerSupabase: () => ({
    rpc: mockRpc,
  }),
}));

import { reserveCreditsAtomic } from "@/lib/credits/client";

describe("Atomic reserveCredits", () => {
  const userId = "00000000-0000-0000-0000-000000000001";
  const tenantId = "test-tenant";
  const amount = 10.5;

  beforeEach(() => {
    mockRpc.mockReset();
  });

  it("retourne success si RPC retourne un ID valide", async () => {
    mockRpc.mockResolvedValue({
      data: {
        id: "res-123",
        amount,
        status: "reserved",
        is_retry: false,
      },
      error: null,
    });

    const result = await reserveCreditsAtomic(userId, tenantId, amount, "idempotency-key-1");

    expect(result.success).toBe(true);
    expect(result.reservationId).toBe("res-123");
    expect(result.isRetry).toBe(false);
    // Verify RPC signature exposée par P5
    expect(mockRpc).toHaveBeenCalledWith("reserve_credits_atomic", {
      p_user_id: userId,
      p_tenant_id: tenantId,
      p_amount: amount,
      p_idempotency_key: "idempotency-key-1",
    });
  });

  it("retourne error insufficient_credits si balance insuffisant", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "insufficient_credits" },
    });

    const result = await reserveCreditsAtomic(userId, tenantId, amount, "idempotency-key-2");

    expect(result.success).toBe(false);
    expect(result.error).toBe("insufficient_credits");
  });

  it("détecte la retry via is_retry=true (même idempotency key)", async () => {
    mockRpc.mockResolvedValue({
      data: {
        id: "res-123",
        amount,
        status: "reserved",
        is_retry: true,
      },
      error: null,
    });

    const result = await reserveCreditsAtomic(userId, tenantId, amount, "idempotency-key-retry");

    expect(result.success).toBe(true);
    expect(result.isRetry).toBe(true);
  });

  it("gère user_not_found", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "user_not_found" },
    });

    const result = await reserveCreditsAtomic(userId, tenantId, amount, "idempotency-key-3");

    expect(result.success).toBe(false);
    expect(result.error).toBe("user_not_found");
  });

  it("gère RPC error générique", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "unknown error" },
    });

    const result = await reserveCreditsAtomic(userId, tenantId, amount, "idempotency-key-4");

    expect(result.success).toBe(false);
    expect(result.error).toBe("reservation_failed");
  });
});
