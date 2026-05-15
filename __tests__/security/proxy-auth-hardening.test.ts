/**
 * B1.4 — Proxy Auth Hardening
 *
 * F-026 : hasSession() valide le JWT (pas seulement la présence du cookie)
 * F-027 : hasValidApiKey() utilise timingSafeEqual
 * F-053 : isProductionEnv() OR logic sur NODE_ENV / VERCEL_ENV / HEARST_ENV
 */

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// F-026 + F-027 — proxy indirect via mock de getToken
// Les fonctions hasSession / hasValidApiKey ne sont pas exportées, on teste
// le comportement observable via proxy() avec des NextRequest valides.
// ---------------------------------------------------------------------------

const mockGetToken = vi.hoisted(() => vi.fn());

vi.mock("next-auth/jwt", () => ({
  getToken: mockGetToken,
}));

// Mock Arcjet pour ne pas dépendre de la config réseau dans les tests
vi.mock("@/lib/security/arcjet", () => ({
  aj: null,
  ajOrchestrate: null,
  ajLlmJobs: null,
  isArcjetEnabled: () => false,
}));

vi.mock("@/lib/env.server", () => ({}));

vi.mock("@/lib/platform/auth/dev-bypass", () => ({
  isDevBypassEnabled: () => false,
  assertDevBypassNotInProduction: () => {},
}));

function makeNextRequest(opts: {
  path?: string;
  cookies?: Record<string, string>;
  headers?: Record<string, string>;
}): NextRequest {
  const url = `http://localhost${opts.path ?? "/dashboard"}`;
  const mergedHeaders: Record<string, string> = { ...(opts.headers ?? {}) };
  if (opts.cookies) {
    // NextRequest expose cookies en lecture — on les injecte via le header Cookie
    mergedHeaders.cookie = Object.entries(opts.cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }
  return new NextRequest(url, { headers: mergedHeaders });
}

describe("F-026 — hasSession valide le JWT (pas juste la présence du cookie)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXTAUTH_SECRET", "test-secret-32chars-xxxxxxxxxxxxxxx");
    vi.stubEnv("HEARST_API_KEY", "");
  });

  afterEach(() => {
    mockGetToken.mockReset();
    vi.unstubAllEnvs();
  });

  it("cookie présent mais JWT invalide (getToken null) → 401", async () => {
    mockGetToken.mockResolvedValue(null);

    const { proxy } = await import("@/proxy");
    const req = makeNextRequest({
      path: "/api/agents",
      cookies: { "next-auth.session-token": "fake-token" },
    });

    const res = await proxy(req);
    expect(res.status).toBe(401);
  });

  it("cookie présent avec JWT valide (getToken retourne objet) → 200", async () => {
    mockGetToken.mockResolvedValue({ sub: "user-123", email: "test@hearst.io" });

    const { proxy } = await import("@/proxy");
    const req = makeNextRequest({
      path: "/api/agents",
      cookies: { "next-auth.session-token": "valid-token" },
    });

    const res = await proxy(req);
    expect(res.status).toBe(200);
  });

  it("aucun cookie + getToken null → 401", async () => {
    mockGetToken.mockResolvedValue(null);

    const { proxy } = await import("@/proxy");
    const req = makeNextRequest({ path: "/api/agents" });

    const res = await proxy(req);
    expect(res.status).toBe(401);
  });

  it("NEXTAUTH_SECRET absent → refus défensif (401)", async () => {
    vi.stubEnv("NEXTAUTH_SECRET", "");
    mockGetToken.mockResolvedValue(null);

    const { proxy } = await import("@/proxy");
    const req = makeNextRequest({
      path: "/api/agents",
      cookies: { "next-auth.session-token": "anything" },
    });

    const res = await proxy(req);
    expect(res.status).toBe(401);
  });
});

describe("F-027 — hasValidApiKey comparaison constant-time", () => {
  const VALID_KEY = "hearst-api-key-0123456789abcdef";

  beforeEach(async () => {
    vi.resetModules();
    vi.stubEnv("HEARST_API_KEY", VALID_KEY);
    vi.stubEnv("NEXTAUTH_SECRET", "");
    mockGetToken.mockResolvedValue(null);
  });

  afterEach(() => {
    mockGetToken.mockReset();
    vi.unstubAllEnvs();
  });

  it("clé correcte via x-api-key → 200", async () => {
    const { proxy } = await import("@/proxy");
    const req = makeNextRequest({
      path: "/api/agents",
      headers: { "x-api-key": VALID_KEY },
    });

    const res = await proxy(req);
    expect(res.status).toBe(200);
  });

  it("clé incorrecte de même longueur → 401", async () => {
    const { proxy } = await import("@/proxy");
    const req = makeNextRequest({
      path: "/api/agents",
      headers: { "x-api-key": "hearst-api-key-WRONGXXXXXXXXXXXXXXX" },
    });

    const res = await proxy(req);
    expect(res.status).toBe(401);
  });

  it("clé de longueur différente → 401 (pas de throw timingSafeEqual)", async () => {
    const { proxy } = await import("@/proxy");
    const req = makeNextRequest({
      path: "/api/agents",
      headers: { "x-api-key": "short" },
    });

    // Ne doit pas throw, doit retourner 401 proprement
    await expect(proxy(req)).resolves.toHaveProperty("status", 401);
  });

  it("clé via Authorization Bearer → 200", async () => {
    const { proxy } = await import("@/proxy");
    const req = makeNextRequest({
      path: "/api/agents",
      headers: { authorization: `Bearer ${VALID_KEY}` },
    });

    const res = await proxy(req);
    expect(res.status).toBe(200);
  });
});
