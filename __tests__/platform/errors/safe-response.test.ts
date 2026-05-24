/**
 * safeErrorResponse — Tests unitaires
 *
 * Vérifie que le helper ne leak jamais de stack en prod,
 * retourne le message complet en dev, inclut toujours un request_id,
 * set le header X-Request-Id, gère les objets non-Error avec .message,
 * et appelle logger.error avec le contexte complet.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

// --- Mock logger AVANT d'importer le module sous test (hoisted) ---
const mockLoggerError = vi.hoisted(() => vi.fn());

vi.mock("@/lib/observability/logger", () => ({
  logger: {
    error: mockLoggerError,
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
  withRoute: () => ({
    error: mockLoggerError,
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock NextResponse avec headers.set simulé
vi.mock("next/server", () => {
  return {
    NextResponse: {
      json: vi.fn((body: unknown, init?: { status?: number }) => {
        const headersMap = new Map<string, string>();
        return {
          _body: body,
          _status: init?.status ?? 200,
          json: async () => body,
          status: init?.status ?? 200,
          headers: {
            set: (key: string, value: string) => headersMap.set(key, value),
            get: (key: string) => headersMap.get(key) ?? null,
            _map: headersMap,
          },
        };
      }),
    },
  };
});

import { safeErrorResponse } from "@/lib/platform/errors/safe-response";

describe("safeErrorResponse", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("retourne le message complet en mode dev", () => {
    vi.stubEnv("NODE_ENV", "development");

    const err = new Error("Supabase: invalid JWT token abc123secret");
    const res = safeErrorResponse(err, { route: "GET /api/test" }) as unknown as {
      _body: { error: string; message: string; request_id: string };
      _status: number;
    };

    expect(res._body.message).toBe("Supabase: invalid JWT token abc123secret");
    expect(res._body.error).toBe("internal_server_error");
  });

  it("masque le message en mode production", () => {
    vi.stubEnv("NODE_ENV", "production");

    const err = new Error("Supabase: invalid JWT token abc123secret");
    const res = safeErrorResponse(err, { route: "GET /api/test" }) as unknown as {
      _body: { error: string; message: string; request_id: string };
      _status: number;
    };

    expect(res._body.message).not.toContain("Supabase");
    expect(res._body.message).not.toContain("abc123secret");
    expect(res._body.message).toBe("Une erreur interne est survenue. Réessayez plus tard.");
    expect(res._body.error).toBe("internal_server_error");
  });

  it("inclut toujours un request_id UUID non vide", () => {
    vi.stubEnv("NODE_ENV", "production");

    const res1 = safeErrorResponse(new Error("boom"), { route: "GET /api/test" }) as unknown as {
      _body: { request_id: string };
    };
    const res2 = safeErrorResponse(new Error("boom"), { route: "GET /api/test" }) as unknown as {
      _body: { request_id: string };
    };

    expect(res1._body.request_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    // Chaque appel génère un UUID distinct
    expect(res1._body.request_id).not.toBe(res2._body.request_id);
  });

  it("respecte le status code fourni", () => {
    vi.stubEnv("NODE_ENV", "production");

    const res = safeErrorResponse(
      new Error("oops"),
      { route: "POST /api/test" },
      503,
    ) as unknown as {
      _status: number;
    };

    expect(res._status).toBe(503);
  });

  it("utilise 500 comme status par défaut", () => {
    vi.stubEnv("NODE_ENV", "production");

    const res = safeErrorResponse(new Error("oops"), { route: "GET /api/test" }) as unknown as {
      _status: number;
    };

    expect(res._status).toBe(500);
  });

  it("appelle logger.error avec le contexte complet (route, err_message, request_id)", () => {
    vi.stubEnv("NODE_ENV", "development");

    const err = new Error("db connection refused");
    safeErrorResponse(err, {
      route: "POST /api/v2/kg/ingest",
      scope: { tenantId: "tenant-123", userId: "user-456" },
    });

    expect(mockLoggerError).toHaveBeenCalledOnce();
    const [logCtx, logMsg] = mockLoggerError.mock.calls[0];
    expect(logCtx.route).toBe("POST /api/v2/kg/ingest");
    expect(logCtx.tenant_id).toBe("tenant-123");
    expect(logCtx.user_id).toBe("user-456");
    expect(logCtx.err_message).toBe("db connection refused");
    expect(logCtx.request_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(logMsg).toContain("[POST /api/v2/kg/ingest]");
  });

  it("gère les exceptions non-Error (string)", () => {
    vi.stubEnv("NODE_ENV", "development");

    const res = safeErrorResponse("string error", { route: "GET /api/test" }) as unknown as {
      _body: { message: string };
    };

    expect(res._body.message).toBe("string error");
    expect(mockLoggerError).toHaveBeenCalledOnce();
    const [logCtx] = mockLoggerError.mock.calls[0];
    expect(logCtx.err_message).toBe("string error");
    expect(logCtx.err_stack).toBeUndefined();
  });

  it("ne leak pas de stack en production", () => {
    vi.stubEnv("NODE_ENV", "production");

    const err = new Error("Internal: SELECT * FROM users WHERE id=$1");
    err.stack =
      "Error: Internal: SELECT * FROM users WHERE id=$1\n    at Object.GET (/app/route.ts:42)";

    const res = safeErrorResponse(err, { route: "GET /api/test" }) as unknown as {
      _body: Record<string, unknown>;
    };

    const bodyStr = JSON.stringify(res._body);
    expect(bodyStr).not.toContain("SELECT");
    expect(bodyStr).not.toContain("route.ts");
    expect(bodyStr).not.toContain("stack");
  });

  // AC4 — nouveau : header X-Request-Id
  it("set le header X-Request-Id égal au request_id du body", () => {
    vi.stubEnv("NODE_ENV", "production");

    const res = safeErrorResponse(new Error("boom"), { route: "GET /api/test" }) as unknown as {
      _body: { request_id: string };
      headers: { get: (k: string) => string | null };
    };

    const headerValue = res.headers.get("X-Request-Id");
    expect(headerValue).toBeTruthy();
    expect(headerValue).toBe(res._body.request_id);
  });

  // AC4 — nouveau : fallback cause.message pour objets non-Error (pattern Supabase)
  it("extrait le message d'un objet non-Error avec champ .message (pattern Supabase)", () => {
    vi.stubEnv("NODE_ENV", "development");

    const supabaseError = {
      message: "constraint violation",
      code: "23505",
      details: "Key (id)...",
    };
    const res = safeErrorResponse(supabaseError, { route: "POST /api/test" }) as unknown as {
      _body: { message: string };
    };

    expect(res._body.message).toBe("constraint violation");
    expect(mockLoggerError).toHaveBeenCalledOnce();
    const [logCtx] = mockLoggerError.mock.calls[0];
    expect(logCtx.err_message).toBe("constraint violation");
  });
});
