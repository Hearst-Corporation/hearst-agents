/**
 * Fix #2 — Daily cost cap sur /api/orchestrate et /api/v1/chat
 *
 * Vérifie que :
 * - Si ORCHESTRATE_COST_CAP_USD est défini et que l'usage dépasse la cap,
 *   les routes retournent 429 avec Retry-After.
 * - Si ORCHESTRATE_COST_CAP_USD est absent ou 0, aucun 429 n'est émis
 *   (comportement actuel préservé).
 */

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks hoisted ──────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  requireScope: vi.fn(),
  withApiAuth: vi.fn(),
  hasApiScope: vi.fn(() => true),
  getTenantUsage: vi.fn(),
  orchestrate: vi.fn(),
  ensureSchedulerStarted: vi.fn(),
  requireServerSupabase: vi.fn(() => ({})),
}));

vi.mock("@/lib/platform/auth/scope", () => ({
  requireScope: mocks.requireScope,
}));

vi.mock("@/lib/llm/usage-tracker", () => ({
  getTenantUsage: mocks.getTenantUsage,
}));

vi.mock("@/lib/engine/orchestrator", () => ({
  orchestrate: mocks.orchestrate,
}));

vi.mock("@/lib/engine/runtime/missions/scheduler-init", () => ({
  ensureSchedulerStarted: mocks.ensureSchedulerStarted,
}));

vi.mock("@/lib/platform/db/supabase", () => ({
  requireServerSupabase: mocks.requireServerSupabase,
}));

vi.mock("@/lib/memory/store", () => ({
  MAX_MESSAGES_PER_CONVERSATION: 20,
}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/platform/auth/options", () => ({
  authOptions: {},
}));

// Pour /api/v1/chat — withApiAuth wrapper
vi.mock("@/lib/platform/http/api-auth", () => ({
  hasApiScope: mocks.hasApiScope,
  withApiAuth: (
    _label: string,
    handler: (req: NextRequest, ctx: { tenant: Record<string, string> }) => Promise<Response>,
  ) => {
    return (req: NextRequest) =>
      handler(req, {
        tenant: {
          tenantId: "tenant-1",
          userId: "user-1",
        },
      });
  },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SCOPE = {
  userId: "user-1",
  tenantId: "tenant-1",
  workspaceId: "ws-1",
  userName: "Test User",
  isDevFallback: false,
};

function makePostReq(url: string, body: unknown = {}): NextRequest {
  return new NextRequest(new URL(url, "http://localhost"), {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

// ─── /api/orchestrate ─────────────────────────────────────────────────────

describe("POST /api/orchestrate — daily cost cap", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...OLD_ENV };
    Object.values(mocks).forEach((m) => {
      if (typeof m === "function" && "mockReset" in m) m.mockReset();
    });
    mocks.requireScope.mockResolvedValue({ scope: SCOPE, error: null });
    mocks.hasApiScope.mockReturnValue(true);
    mocks.orchestrate.mockReturnValue(new ReadableStream());
    mocks.ensureSchedulerStarted.mockResolvedValue(undefined);
    mocks.requireServerSupabase.mockReturnValue({});
  });

  afterEach(() => {
    process.env = OLD_ENV;
    vi.restoreAllMocks();
  });

  it("retourne 429 quand l'usage daily dépasse la cap", async () => {
    process.env.ORCHESTRATE_COST_CAP_USD = "1.00";
    mocks.getTenantUsage.mockResolvedValue({
      total_tokens_in: 10000,
      total_tokens_out: 5000,
      total_cost_usd: 1.5, // > 1.00
      by_day: [],
    });

    const { POST } = await import("@/app/api/orchestrate/route");
    const res = await POST(makePostReq("http://localhost/api/orchestrate", { message: "bonjour" }));

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe("daily_cost_cap_reached");
    expect(body.cap).toBe(1.0);
    expect(body.used).toBe(1.5);
    expect(res.headers.get("Retry-After")).toBe("3600");
    expect(mocks.orchestrate).not.toHaveBeenCalled();
  });

  it("laisse passer quand l'usage est sous la cap", async () => {
    process.env.ORCHESTRATE_COST_CAP_USD = "1.00";
    mocks.getTenantUsage.mockResolvedValue({
      total_tokens_in: 1000,
      total_tokens_out: 500,
      total_cost_usd: 0.3, // < 1.00
      by_day: [],
    });

    const { POST } = await import("@/app/api/orchestrate/route");
    const res = await POST(makePostReq("http://localhost/api/orchestrate", { message: "bonjour" }));

    expect(res.status).not.toBe(429);
    // 200 ou SSE stream
    expect(mocks.getTenantUsage).toHaveBeenCalledWith("tenant-1", 1);
  });

  it("ne vérifie pas la cap si ORCHESTRATE_COST_CAP_USD absent (no-op)", async () => {
    delete process.env.ORCHESTRATE_COST_CAP_USD;
    mocks.getTenantUsage.mockResolvedValue({
      total_cost_usd: 999,
      total_tokens_in: 0,
      total_tokens_out: 0,
      by_day: [],
    });

    const { POST } = await import("@/app/api/orchestrate/route");
    const res = await POST(makePostReq("http://localhost/api/orchestrate", { message: "bonjour" }));

    expect(mocks.getTenantUsage).not.toHaveBeenCalled();
    expect(res.status).not.toBe(429);
  });

  it("ne vérifie pas la cap si ORCHESTRATE_COST_CAP_USD=0 (no-op)", async () => {
    process.env.ORCHESTRATE_COST_CAP_USD = "0";

    const { POST } = await import("@/app/api/orchestrate/route");
    await POST(makePostReq("http://localhost/api/orchestrate", { message: "bonjour" }));

    expect(mocks.getTenantUsage).not.toHaveBeenCalled();
  });

  it("laisse passer si getTenantUsage retourne null (best-effort)", async () => {
    process.env.ORCHESTRATE_COST_CAP_USD = "1.00";
    mocks.getTenantUsage.mockResolvedValue(null);

    const { POST } = await import("@/app/api/orchestrate/route");
    const res = await POST(makePostReq("http://localhost/api/orchestrate", { message: "bonjour" }));

    expect(res.status).not.toBe(429);
  });
});

// ─── /api/v1/chat ─────────────────────────────────────────────────────────

describe("POST /api/v1/chat — daily cost cap", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...OLD_ENV };
    Object.values(mocks).forEach((m) => {
      if (typeof m === "function" && "mockReset" in m) m.mockReset();
    });
    mocks.requireScope.mockResolvedValue({ scope: SCOPE, error: null });
    mocks.hasApiScope.mockReturnValue(true);
    mocks.orchestrate.mockReturnValue(new ReadableStream());
    mocks.requireServerSupabase.mockReturnValue({});
  });

  afterEach(() => {
    process.env = OLD_ENV;
    vi.restoreAllMocks();
  });

  it("retourne 429 quand l'usage daily dépasse la cap", async () => {
    process.env.ORCHESTRATE_COST_CAP_USD = "0.50";
    mocks.getTenantUsage.mockResolvedValue({
      total_tokens_in: 5000,
      total_tokens_out: 2000,
      total_cost_usd: 0.8,
      by_day: [],
    });

    const { POST } = await import("@/app/api/v1/chat/route");
    const res = await POST(makePostReq("http://localhost/api/v1/chat", { message: "bonjour" }));

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe("daily_cost_cap_reached");
    expect(res.headers.get("Retry-After")).toBe("3600");
    expect(mocks.orchestrate).not.toHaveBeenCalled();
  });

  it("ne vérifie pas la cap si ORCHESTRATE_COST_CAP_USD absent (no-op)", async () => {
    delete process.env.ORCHESTRATE_COST_CAP_USD;

    const { POST } = await import("@/app/api/v1/chat/route");
    await POST(makePostReq("http://localhost/api/v1/chat", { message: "bonjour" }));

    expect(mocks.getTenantUsage).not.toHaveBeenCalled();
  });
});
