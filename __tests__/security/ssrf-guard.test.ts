/**
 * B2.1 — SSRF Guard tests
 *
 * F-008, F-009, F-103 : validation assertSafeUrl + isUrlShapeAllowed
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { assertSafeUrl, isUrlShapeAllowed, SsrfBlockedError } from "@/lib/security/ssrf-guard";

// ── Mock DNS lookup ──────────────────────────────────────────────────────────
// On mock node:dns/promises pour contrôler les réponses DNS sans réseau réel.

const mockLookup = vi.hoisted(() => vi.fn());

vi.mock("node:dns/promises", () => ({
  lookup: mockLookup,
}));

// Par défaut : résolution publique (93.184.216.34 = example.com)
function mockPublicDns() {
  mockLookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
}

// Résolution vers IP privée (DNS rebinding)
function mockPrivateDns(ip: string, family: 4 | 6 = 4) {
  mockLookup.mockResolvedValue([{ address: ip, family }]);
}

beforeEach(() => {
  mockLookup.mockReset();
  mockPublicDns();
});

// ── assertSafeUrl ────────────────────────────────────────────────────────────

describe("assertSafeUrl", () => {
  it("bloque AWS instance metadata (169.254.169.254)", async () => {
    // IP littérale — pas de DNS nécessaire
    await expect(assertSafeUrl("http://169.254.169.254/latest/meta-data/")).rejects.toBeInstanceOf(
      SsrfBlockedError,
    );
  });

  it("bloque localhost par hostname", async () => {
    await expect(assertSafeUrl("http://localhost:6379/")).rejects.toBeInstanceOf(SsrfBlockedError);
  });

  it("bloque localhost par IP littérale (127.0.0.1)", async () => {
    await expect(assertSafeUrl("http://127.0.0.1/")).rejects.toBeInstanceOf(SsrfBlockedError);
  });

  it("bloque RFC1918 172.16.x.x littéral", async () => {
    await expect(assertSafeUrl("https://172.16.0.1/")).rejects.toBeInstanceOf(SsrfBlockedError);
  });

  it("bloque RFC1918 10.x.x.x littéral", async () => {
    await expect(assertSafeUrl("https://10.0.0.1/secret")).rejects.toBeInstanceOf(SsrfBlockedError);
  });

  it("bloque RFC1918 192.168.x.x littéral", async () => {
    await expect(assertSafeUrl("https://192.168.1.1/")).rejects.toBeInstanceOf(SsrfBlockedError);
  });

  it("bloque scheme file://", async () => {
    await expect(assertSafeUrl("file:///etc/passwd")).rejects.toBeInstanceOf(SsrfBlockedError);
  });

  it("bloque scheme ftp://", async () => {
    await expect(assertSafeUrl("ftp://example.com/file")).rejects.toBeInstanceOf(SsrfBlockedError);
  });

  it("bloque metadata.google.internal", async () => {
    await expect(
      assertSafeUrl("http://metadata.google.internal/computeMetadata/v1/"),
    ).rejects.toBeInstanceOf(SsrfBlockedError);
  });

  it("bloque les hostnames .local", async () => {
    await expect(assertSafeUrl("http://myservice.local/api")).rejects.toBeInstanceOf(
      SsrfBlockedError,
    );
  });

  it("bloque les hostnames .internal", async () => {
    await expect(assertSafeUrl("http://db.internal/admin")).rejects.toBeInstanceOf(
      SsrfBlockedError,
    );
  });

  it("bloque DNS rebinding (hostname public mais résolution IP privée)", async () => {
    // DNS rebinding : evil.com résout vers 10.0.0.1
    mockPrivateDns("10.0.0.1", 4);
    await expect(assertSafeUrl("https://evil.com/hook")).rejects.toBeInstanceOf(SsrfBlockedError);
  });

  it("bloque DNS rebinding via IPv6 loopback", async () => {
    mockPrivateDns("::1", 6);
    await expect(assertSafeUrl("https://evil.com/hook")).rejects.toBeInstanceOf(SsrfBlockedError);
  });

  it("bloque si DNS lookup échoue (NXDOMAIN)", async () => {
    mockLookup.mockRejectedValue(new Error("ENOTFOUND nonexistent.invalid"));
    await expect(assertSafeUrl("https://nonexistent.invalid/")).rejects.toBeInstanceOf(
      SsrfBlockedError,
    );
  });

  it("accepte une URL HTTPS publique valide", async () => {
    mockPublicDns();
    const result = await assertSafeUrl("https://example.com/");
    expect(result).toBeInstanceOf(URL);
    expect(result.hostname).toBe("example.com");
  });

  it("accepte une URL HTTP publique quand http: est dans allowedSchemes", async () => {
    mockPublicDns();
    const result = await assertSafeUrl("http://example.com/", {
      allowedSchemes: ["http:", "https:"],
    });
    expect(result).toBeInstanceOf(URL);
  });

  it("bloque HTTP quand seul https: est autorisé", async () => {
    await expect(
      assertSafeUrl("http://example.com/", { allowedSchemes: ["https:"] }),
    ).rejects.toBeInstanceOf(SsrfBlockedError);
  });

  it("bloque les URL malformées", async () => {
    await expect(assertSafeUrl("not-a-url")).rejects.toBeInstanceOf(SsrfBlockedError);
    await expect(assertSafeUrl("")).rejects.toBeInstanceOf(SsrfBlockedError);
  });

  it("SsrfBlockedError expose reason et url", async () => {
    let err: SsrfBlockedError | null = null;
    try {
      await assertSafeUrl("file:///etc/passwd");
    } catch (e) {
      if (e instanceof SsrfBlockedError) err = e;
    }
    expect(err).not.toBeNull();
    expect(err?.reason).toContain("file");
    expect(err?.url).toBe("file:///etc/passwd");
  });
});

// ── isUrlShapeAllowed ────────────────────────────────────────────────────────

describe("isUrlShapeAllowed (sync Zod refine)", () => {
  it("rejette localhost", () => {
    expect(isUrlShapeAllowed("http://localhost/")).toBe(false);
  });

  it("rejette IP littérale 127.0.0.1", () => {
    expect(isUrlShapeAllowed("http://127.0.0.1/")).toBe(false);
  });

  it("rejette 169.254.169.254", () => {
    expect(isUrlShapeAllowed("https://169.254.169.254/")).toBe(false);
  });

  it("rejette 10.0.0.1", () => {
    expect(isUrlShapeAllowed("https://10.0.0.1/")).toBe(false);
  });

  it("rejette file://", () => {
    expect(isUrlShapeAllowed("file:///etc/passwd")).toBe(false);
  });

  it("rejette .local hostname", () => {
    expect(isUrlShapeAllowed("http://myservice.local/")).toBe(false);
  });

  it("accepte une URL https publique", () => {
    expect(isUrlShapeAllowed("https://example.com/")).toBe(true);
  });

  it("accepte une URL http publique avec allowedSchemes étendu", () => {
    expect(isUrlShapeAllowed("http://example.com/", { allowedSchemes: ["http:", "https:"] })).toBe(
      true,
    );
  });

  it("rejette http quand seul https autorisé", () => {
    expect(isUrlShapeAllowed("http://example.com/", { allowedSchemes: ["https:"] })).toBe(false);
  });
});
