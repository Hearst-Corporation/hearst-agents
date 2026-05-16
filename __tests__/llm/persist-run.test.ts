import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock @supabase/supabase-js createClient avant l'import de persistRun
// ---------------------------------------------------------------------------
const mockInsert = vi.fn();
const mockFrom = vi.fn(() => ({ insert: mockInsert }));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}));

vi.mock("@/lib/observability/logger", () => ({
  logger: {
    warn: vi.fn(),
  },
}));

// Env vars nécessaires pour que persistRun crée le client
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key-test";

import { persistRun } from "@/lib/llm/persist-run";
import { logger } from "@/lib/observability/logger";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const baseOpts = {
  tenantId: "00000000-0000-0000-0000-000000000001",
  userId: "00000000-0000-0000-0000-000000000002",
  provider: "anthropic",
  model: "claude-sonnet-4-6",
  inputTokens: 1000,
  outputTokens: 500,
  costUsd: 0.0123,
  latencyMs: 850,
  status: "success" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  // Default: Supabase returns no error
  mockInsert.mockResolvedValue({ error: null });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("persistRun", () => {
  it("appelle insert avec la bonne shape sur un succès", async () => {
    await persistRun(baseOpts);

    expect(mockFrom).toHaveBeenCalledWith("llm_runs");
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: baseOpts.tenantId,
        user_id: baseOpts.userId,
        provider: baseOpts.provider,
        model: baseOpts.model,
        input_tokens: baseOpts.inputTokens,
        output_tokens: baseOpts.outputTokens,
        cost_usd: baseOpts.costUsd,
        latency_ms: baseOpts.latencyMs,
        status: "success",
      }),
    );
  });

  it("ne throw PAS si Supabase retourne une erreur (fire-and-forget)", async () => {
    mockInsert.mockResolvedValue({ error: { message: "DB error" } });

    await expect(persistRun(baseOpts)).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ message: "DB error" }) }),
      "[persistRun] insert failed",
    );
  });

  it("ne throw PAS si le client Supabase throw (fire-and-forget)", async () => {
    // Simule une erreur lors de l'appel .from() (ex. client mal initialisé)
    mockFrom.mockImplementationOnce(() => {
      throw new Error("Supabase init failed");
    });

    await expect(persistRun(baseOpts)).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
      "[persistRun] threw",
    );
  });

  it("stocke status=failed et errorCode quand passés", async () => {
    await persistRun({
      ...baseOpts,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: null,
      latencyMs: 0,
      status: "failed",
      errorCode: "RATE_LIMIT_EXCEEDED",
    });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        error_code: "RATE_LIMIT_EXCEEDED",
        cost_usd: null,
      }),
    );
  });

  it("null pour les champs optionnels non fournis", async () => {
    await persistRun({
      tenantId: baseOpts.tenantId,
      provider: "openai",
      model: "gpt-4o",
      inputTokens: 200,
      outputTokens: 100,
      costUsd: null,
      latencyMs: 300,
      status: "success",
    });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: null,
        conversation_id: null,
        run_id: null,
        error_code: null,
        provider_request_id: null,
      }),
    );
  });
});
