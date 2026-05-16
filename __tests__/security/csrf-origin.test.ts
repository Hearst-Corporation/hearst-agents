/**
 * CSRF Origin Check Test — F-052
 *
 * Valide que proxy.ts refuse les mutations (POST/PUT/DELETE/PATCH) sans
 * Origin header matching NEXTAUTH_URL.
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { isCsrfSafe } from "@/proxy";

describe("CSRF Origin Check (F-052)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("should allow GET requests without Origin header", () => {
    // GET/HEAD/OPTIONS ne changent pas l'état → safe
    const req = new NextRequest(new URL("http://localhost/api/test"), {
      method: "GET",
    });
    expect(isCsrfSafe(req)).toBe(true);
  });

  it("should allow HEAD requests without Origin header", () => {
    // HEAD ne changent pas l'état → safe
    const req = new NextRequest(new URL("http://localhost/api/test"), {
      method: "HEAD",
    });
    expect(isCsrfSafe(req)).toBe(true);
  });

  it("should allow OPTIONS requests without Origin header", () => {
    // OPTIONS ne changent pas l'état → safe
    const req = new NextRequest(new URL("http://localhost/api/test"), {
      method: "OPTIONS",
    });
    expect(isCsrfSafe(req)).toBe(true);
  });

  it("should reject POST without Origin header", () => {
    // POST sans Origin est suspect (possible CSRF)
    vi.stubEnv("NEXTAUTH_URL", "https://hearst-os.vercel.app");
    const req = new NextRequest(new URL("http://localhost/api/test"), {
      method: "POST",
    });
    expect(isCsrfSafe(req)).toBe(false);
  });

  it("should reject POST with mismatched Origin", () => {
    // Origin: https://attacker.com vs NEXTAUTH_URL: https://hearst-os.vercel.app → 403
    vi.stubEnv("NEXTAUTH_URL", "https://hearst-os.vercel.app");
    const req = new NextRequest(new URL("http://localhost/api/test"), {
      method: "POST",
      headers: {
        origin: "https://attacker.com",
      },
    });
    expect(isCsrfSafe(req)).toBe(false);
  });

  it("should allow POST with matching Origin", () => {
    // Origin: https://hearst-os.vercel.app vs NEXTAUTH_URL: https://hearst-os.vercel.app → OK
    vi.stubEnv("NEXTAUTH_URL", "https://hearst-os.vercel.app");
    const req = new NextRequest(new URL("http://localhost/api/test"), {
      method: "POST",
      headers: {
        origin: "https://hearst-os.vercel.app",
      },
    });
    expect(isCsrfSafe(req)).toBe(true);
  });

  it("should bypass CSRF check for /api/webhooks/inngest (signed)", () => {
    // /api/webhooks/inngest/* sont signés côté Inngest → pas besoin d'Origin
    const req = new NextRequest(new URL("http://localhost/api/webhooks/inngest/run"), {
      method: "POST",
    });
    expect(isCsrfSafe(req)).toBe(true);
  });

  it("should bypass CSRF check for /api/inngest (signed)", () => {
    // /api/inngest/* sont signés côté Inngest → pas besoin d'Origin
    const req = new NextRequest(new URL("http://localhost/api/inngest"), {
      method: "POST",
    });
    expect(isCsrfSafe(req)).toBe(true);
  });

  it("should reject PUT with mismatched Origin", () => {
    // PUT est mutation, doit vérifier Origin
    vi.stubEnv("NEXTAUTH_URL", "https://hearst-os.vercel.app");
    const req = new NextRequest(new URL("http://localhost/api/test"), {
      method: "PUT",
      headers: {
        origin: "https://attacker.com",
      },
    });
    expect(isCsrfSafe(req)).toBe(false);
  });

  it("should reject DELETE with mismatched Origin", () => {
    // DELETE est mutation, doit vérifier Origin
    vi.stubEnv("NEXTAUTH_URL", "https://hearst-os.vercel.app");
    const req = new NextRequest(new URL("http://localhost/api/test"), {
      method: "DELETE",
      headers: {
        origin: "https://attacker.com",
      },
    });
    expect(isCsrfSafe(req)).toBe(false);
  });

  it("should reject PATCH with mismatched Origin", () => {
    // PATCH est mutation, doit vérifier Origin
    vi.stubEnv("NEXTAUTH_URL", "https://hearst-os.vercel.app");
    const req = new NextRequest(new URL("http://localhost/api/test"), {
      method: "PATCH",
      headers: {
        origin: "https://attacker.com",
      },
    });
    expect(isCsrfSafe(req)).toBe(false);
  });
});
