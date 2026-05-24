/**
 * CSP Nonce Helper Test — F-078-nonce
 *
 * Valide que generateNonce() produit des valeurs cryptographiquement aléatoires
 * valides pour une utilisation comme nonce CSP, et que buildCsp() génère une
 * directive Content-Security-Policy cohérente avec 'strict-dynamic'.
 *
 * Test AC1/AC3 : vérifie que proxy() utilise NextResponse.next({ request: { headers } })
 * pour propager le nonce aux Server Components.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildCsp, generateNonce, NONCE_HEADER } from "@/lib/security/csp-nonce";

describe("CSP Nonce Helper (F-078-nonce)", () => {
  it("should generate a valid base64 nonce of 16 bytes", () => {
    const nonce = generateNonce();
    // 16 bytes base64 = ceil(16 * 4 / 3) = 24 chars (avec padding '=')
    // base64 standard : [A-Za-z0-9+/=]
    expect(typeof nonce).toBe("string");
    expect(nonce.length).toBeGreaterThan(0);
    // Décodé → doit être 16 bytes
    const decoded = Buffer.from(nonce, "base64");
    expect(decoded.length).toBe(16);
  });

  it("should generate different nonces on each call (randomness)", () => {
    const nonces = new Set<string>();
    for (let i = 0; i < 100; i++) {
      nonces.add(generateNonce());
    }
    // 100 nonces aléatoires → très peu probable d'avoir une collision
    expect(nonces.size).toBe(100);
  });

  it("should export NONCE_HEADER as 'x-csp-nonce'", () => {
    expect(NONCE_HEADER).toBe("x-csp-nonce");
  });

  it("should build CSP with nonce in script-src", () => {
    const nonce = generateNonce();
    const csp = buildCsp(nonce, false);
    expect(csp).toContain(`'nonce-${nonce}'`);
    expect(csp).toContain("script-src");
  });

  it("should include 'strict-dynamic' in script-src", () => {
    const nonce = generateNonce();
    const csp = buildCsp(nonce, false);
    expect(csp).toContain("'strict-dynamic'");
  });

  it("should include 'unsafe-inline' as fallback in script-src (vieux navigateurs)", () => {
    // 'unsafe-inline' est ignoré par les navigateurs supportant strict-dynamic,
    // mais requis comme fallback pour IE11 / Safari < 15.4
    const nonce = generateNonce();
    const csp = buildCsp(nonce, false);
    const scriptSrc = csp.split(";").find((d) => d.trim().startsWith("script-src"));
    expect(scriptSrc).toContain("'unsafe-inline'");
  });

  it("should include unsafe-eval in dev mode only", () => {
    const nonce = generateNonce();
    const cspDev = buildCsp(nonce, true);
    const cspProd = buildCsp(nonce, false);
    expect(cspDev).toContain("'unsafe-eval'");
    expect(cspProd).not.toContain("'unsafe-eval'");
  });

  it("should include frame-ancestors 'none' to prevent clickjacking", () => {
    const nonce = generateNonce();
    const csp = buildCsp(nonce, false);
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("should include required connect-src origins", () => {
    const nonce = generateNonce();
    const csp = buildCsp(nonce, false);
    expect(csp).toContain("*.supabase.co");
    expect(csp).toContain("cloud.langfuse.com");
    expect(csp).toContain("api.hypercli.com");
    expect(csp).toContain("*.spline.design");
  });

  it("should include nonce in style-src", () => {
    const nonce = generateNonce();
    const csp = buildCsp(nonce, false);
    const styleSrc = csp.split(";").find((d) => d.trim().startsWith("style-src"));
    expect(styleSrc).toContain(`'nonce-${nonce}'`);
  });

  it("should include default-src 'self'", () => {
    const nonce = generateNonce();
    const csp = buildCsp(nonce, false);
    expect(csp).toContain("default-src 'self'");
  });
});

/**
 * AC3 — Test de propagation nonce via NextResponse.next({ request: { headers } })
 *
 * Valide que proxy() construit sa réponse avec les request headers modifiés
 * (nonce inclus) pour que les Server Components puissent lire le nonce via
 * headers().get(NONCE_HEADER).
 *
 * Approche : mock NextResponse.next pour capturer les arguments passés.
 */
describe("proxy() — nonce propagation (AC1/AC3 F-078-nonce-fix)", () => {
  beforeEach(() => {
    vi.resetModules();
    // Reset env mocks
    vi.stubEnv("NEXTAUTH_URL", "https://app.hearst.ai");
    vi.stubEnv("NEXTAUTH_SECRET", "test-secret-32bytes-minimum-ok!");
    vi.stubEnv("NODE_ENV", "test");
  });

  it("should call NextResponse.next with { request: { headers } } containing the nonce", async () => {
    // Mock next/server pour capturer les arguments
    const capturedNextArgs: unknown[] = [];
    const mockNextResponse = vi.fn((args?: unknown) => {
      capturedNextArgs.push(args);
      return {
        headers: new Headers(),
        status: 200,
      };
    });

    vi.doMock("next/server", () => ({
      NextResponse: {
        next: mockNextResponse,
        json: vi.fn((body, init) => ({ headers: new Headers(), ...init })),
        redirect: vi.fn((url) => ({ headers: new Headers(), url })),
      },
    }));

    vi.doMock("@/lib/platform/auth/dev-bypass", () => ({
      isDevBypassEnabled: () => true, // bypass auth pour simplifier le test
    }));

    vi.doMock("@/lib/security/arcjet", () => ({
      isArcjetEnabled: () => false,
      aj: null,
      ajLlmJobs: null,
      ajOrchestrate: null,
    }));

    vi.doMock("next-auth/jwt", () => ({
      getToken: vi.fn().mockResolvedValue({ sub: "user-123", refreshToken: "tok" }),
    }));

    const { proxy } = await import("@/proxy");

    const req = new Request("https://app.hearst.ai/dashboard", {
      method: "GET",
      headers: { host: "app.hearst.ai" },
    }) as unknown as import("next/server").NextRequest;

    // Ajoute nextUrl (Next.js spécifique)
    Object.defineProperty(req, "nextUrl", {
      value: new URL("https://app.hearst.ai/dashboard"),
      writable: false,
    });

    await proxy(req);

    // Vérifier qu'au moins un appel NextResponse.next a reçu { request: { headers } }
    const callsWithRequestHeaders = capturedNextArgs.filter(
      (arg) =>
        arg !== undefined &&
        typeof arg === "object" &&
        arg !== null &&
        "request" in arg &&
        typeof (arg as { request?: unknown }).request === "object",
    );

    expect(callsWithRequestHeaders.length).toBeGreaterThan(0);

    // Vérifier que les headers propagés contiennent le nonce
    const firstCall = callsWithRequestHeaders[0] as {
      request: { headers: Headers };
    };
    const propagatedHeaders = firstCall.request?.headers;
    expect(propagatedHeaders).toBeDefined();
    if (propagatedHeaders instanceof Headers) {
      const nonceValue = propagatedHeaders.get(NONCE_HEADER);
      expect(nonceValue).toBeTruthy();
      expect(typeof nonceValue).toBe("string");
      // Le nonce doit être un base64 valide de 16 bytes (24 chars avec padding)
      if (nonceValue) {
        const decoded = Buffer.from(nonceValue, "base64");
        expect(decoded.length).toBe(16);
      }
    }
  });

  it("NONCE_HEADER constant must be x-csp-nonce (stable key for Server Components)", () => {
    // Régression guard : si ce header change, app/layout.tsx et les Server Components
    // ne trouveront plus le nonce et la CSP sera cassée.
    expect(NONCE_HEADER).toBe("x-csp-nonce");
  });
});
