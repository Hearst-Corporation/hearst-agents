/**
 * Tests du HOF `withScope` + `withAdmin` (lib/platform/http/route-handler.ts).
 *
 * Couvre :
 *  - scope OK → handler appelé avec scope.userId/tenantId
 *  - scope KO → 401 (auth manquante)
 *  - params dynamiques Next.js 15 (Promise<{...}>) bien dénoués
 *  - handler peut retourner NextResponse ou Response
 *  - withAdmin propage la réponse d'erreur du guard sans appeler le handler
 *  - withAdmin appelle le handler avec db + scope quand le guard passe
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireScope = vi.hoisted(() => vi.fn());
const mockRequireAdmin = vi.hoisted(() => vi.fn());
const mockIsAdminError = vi.hoisted(() => vi.fn());

vi.mock("@/lib/platform/auth/scope", () => ({
  requireScope: mockRequireScope,
}));

vi.mock("@/app/api/admin/_helpers", () => ({
  requireAdmin: mockRequireAdmin,
  isError: mockIsAdminError,
}));

function makeRequest(url = "http://test.local/api/foo"): NextRequest {
  return new NextRequest(url, { method: "GET" });
}

const VALID_SCOPE = {
  userId: "user-1",
  tenantId: "tenant-1",
  workspaceId: "workspace-1",
  isDevFallback: false,
};

describe("withScope", () => {
  beforeEach(() => {
    mockRequireScope.mockReset();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("scope OK → handler appelé avec scope + retourne sa réponse", async () => {
    mockRequireScope.mockResolvedValueOnce({ scope: VALID_SCOPE, error: null });
    const { withScope } = await import("@/lib/platform/http/route-handler");

    const handler = vi.fn(async (_req, ctx: { scope: typeof VALID_SCOPE }) => {
      return NextResponse.json({ tenantId: ctx.scope.tenantId });
    });

    const route = withScope("GET /api/test", handler);
    const res = await route(makeRequest(), { params: Promise.resolve({}) });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
    const body = (await (res as NextResponse).json()) as { tenantId: string };
    expect(body.tenantId).toBe("tenant-1");
    expect(mockRequireScope).toHaveBeenCalledWith({ context: "GET /api/test" });
  });

  it("scope KO (auth manquante) → 401 + handler non appelé + body { error: 'not_authenticated' }", async () => {
    mockRequireScope.mockResolvedValueOnce({
      scope: null,
      error: { message: "not_authenticated", status: 401 },
    });
    const { withScope } = await import("@/lib/platform/http/route-handler");

    const handler = vi.fn();
    const route = withScope("GET /api/test", handler);
    const res = await route(makeRequest(), { params: Promise.resolve({}) });

    expect(handler).not.toHaveBeenCalled();
    expect(res.status).toBe(401);
    const body = (await (res as NextResponse).json()) as { error: string };
    // P3-2 — vérification explicite du code d'erreur retourné
    expect(body.error).toBe("not_authenticated");
  });

  it("appel sans routeCtx (params optionnel) → handler reçoit params = {}", async () => {
    // P2-4 — withScope doit supporter un appel sans `routeCtx` (utile pour
    // les tests unitaires qui n'ont pas besoin de simuler la signature
    // Next.js 15 `{ params: Promise<{}> }`).
    mockRequireScope.mockResolvedValueOnce({ scope: VALID_SCOPE, error: null });
    const { withScope } = await import("@/lib/platform/http/route-handler");

    const handler = vi.fn(async (_req, ctx: { scope: typeof VALID_SCOPE; params: unknown }) => {
      return NextResponse.json({
        tenantId: ctx.scope.tenantId,
        paramsKeys: Object.keys((ctx.params as object) ?? {}).length,
      });
    });

    const route = withScope("GET /api/foo", handler);
    const res = await route(makeRequest());

    expect(handler).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
    const body = (await (res as NextResponse).json()) as {
      tenantId: string;
      paramsKeys: number;
    };
    expect(body.tenantId).toBe("tenant-1");
    expect(body.paramsKeys).toBe(0);
  });

  it("scope null sans error → 401 par défaut", async () => {
    mockRequireScope.mockResolvedValueOnce({ scope: null, error: null });
    const { withScope } = await import("@/lib/platform/http/route-handler");

    const handler = vi.fn();
    const route = withScope("GET /api/test", handler);
    const res = await route(makeRequest(), { params: Promise.resolve({}) });

    expect(handler).not.toHaveBeenCalled();
    expect(res.status).toBe(401);
  });

  it("params dynamiques (Next.js 15 Promise) sont awaited et passés au handler", async () => {
    mockRequireScope.mockResolvedValueOnce({ scope: VALID_SCOPE, error: null });
    const { withScope } = await import("@/lib/platform/http/route-handler");

    const handler = vi.fn(
      async (_req, ctx: { scope: typeof VALID_SCOPE; params: { id: string } }) => {
        return NextResponse.json({ id: ctx.params.id });
      },
    );

    const route = withScope<{ id: string }>("GET /api/test/[id]", handler);
    const res = await route(makeRequest(), { params: Promise.resolve({ id: "abc-123" }) });

    expect(handler).toHaveBeenCalledTimes(1);
    const callArg = handler.mock.calls[0][1] as { params: { id: string } };
    expect(callArg.params).toEqual({ id: "abc-123" });
    const body = (await (res as NextResponse).json()) as { id: string };
    expect(body.id).toBe("abc-123");
  });

  it("route non-dynamique → params={} dans le handler", async () => {
    mockRequireScope.mockResolvedValueOnce({ scope: VALID_SCOPE, error: null });
    const { withScope } = await import("@/lib/platform/http/route-handler");

    const handler = vi.fn(async (_req, ctx: { params: Record<string, never> }) => {
      return NextResponse.json({ paramKeys: Object.keys(ctx.params).length });
    });

    const route = withScope("GET /api/test", handler);
    const res = await route(makeRequest(), { params: Promise.resolve({}) });
    const body = (await (res as NextResponse).json()) as { paramKeys: number };
    expect(body.paramKeys).toBe(0);
  });

  it("handler peut retourner une Response brute (pas seulement NextResponse)", async () => {
    mockRequireScope.mockResolvedValueOnce({ scope: VALID_SCOPE, error: null });
    const { withScope } = await import("@/lib/platform/http/route-handler");

    const handler = vi.fn(async () => new Response("hello", { status: 200 }));
    const route = withScope("GET /api/raw", handler);
    const res = await route(makeRequest(), { params: Promise.resolve({}) });

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("hello");
  });
});

describe("withAdmin", () => {
  beforeEach(() => {
    mockRequireAdmin.mockReset();
    mockIsAdminError.mockReset();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("guard error → propage la NextResponse + handler non appelé", async () => {
    const errResp = NextResponse.json({ error: "forbidden" }, { status: 403 });
    mockRequireAdmin.mockResolvedValueOnce(errResp);
    mockIsAdminError.mockReturnValueOnce(true);

    const { withAdmin } = await import("@/lib/platform/http/route-handler");

    const handler = vi.fn();
    const route = withAdmin(
      "GET /api/admin/test",
      { resource: "settings", action: "read" },
      handler,
    );
    const res = await route(makeRequest(), { params: Promise.resolve({}) });

    expect(handler).not.toHaveBeenCalled();
    expect(res.status).toBe(403);
    expect(mockRequireAdmin).toHaveBeenCalledWith("GET /api/admin/test", {
      resource: "settings",
      action: "read",
    });
  });

  it("guard renvoie 503 db_unavailable → propage le NextResponse 503 + handler non appelé", async () => {
    // P3-3 — simule le cas où `requireAdmin` retourne directement un
    // NextResponse 503 (DB injoignable). On vérifie que `withAdmin` ne
    // dérive ni le status ni le body, et n'appelle pas le handler.
    const errResp = NextResponse.json({ error: "db_unavailable" }, { status: 503 });
    mockRequireAdmin.mockResolvedValueOnce(errResp);
    mockIsAdminError.mockReturnValueOnce(true);

    const { withAdmin } = await import("@/lib/platform/http/route-handler");

    const handler = vi.fn();
    const route = withAdmin(
      "GET /api/admin/db-down",
      { resource: "settings", action: "read" },
      handler,
    );
    const res = await route(makeRequest(), { params: Promise.resolve({}) });

    expect(handler).not.toHaveBeenCalled();
    expect(res.status).toBe(503);
    const body = (await (res as NextResponse).json()) as { error: string };
    expect(body.error).toBe("db_unavailable");
  });

  it("guard OK → handler reçoit { db, scope, params }", async () => {
    const fakeDb = { from: vi.fn() } as unknown as SupabaseClient;
    mockRequireAdmin.mockResolvedValueOnce({ scope: VALID_SCOPE, db: fakeDb });
    mockIsAdminError.mockReturnValueOnce(false);

    const { withAdmin } = await import("@/lib/platform/http/route-handler");

    const handler = vi.fn(async (_req, ctx) => {
      return NextResponse.json({
        tenantId: ctx.scope.tenantId,
        runId: ctx.params.runId,
        hasDb: typeof ctx.db.from === "function",
      });
    });

    const route = withAdmin<{ runId: string }>(
      "GET /api/admin/runs/[runId]/events",
      { resource: "runs", action: "read" },
      handler,
    );

    const res = await route(makeRequest(), { params: Promise.resolve({ runId: "run-42" }) });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
    const body = (await (res as NextResponse).json()) as {
      tenantId: string;
      runId: string;
      hasDb: boolean;
    };
    expect(body).toEqual({ tenantId: "tenant-1", runId: "run-42", hasDb: true });
  });
});
