/**
 * Security Headers Test — F-078
 *
 * Valide que next.config.ts expose les headers de sécurité statiques (HSTS,
 * X-Frame, Permissions-Policy, Referrer-Policy, X-Content-Type-Options).
 *
 * NOTE : la CSP (Content-Security-Policy) est désormais générée dynamiquement
 * per-request dans proxy.ts avec un nonce + 'strict-dynamic'. Elle n'est plus
 * dans next.config.ts. Voir __tests__/security/csp-nonce.test.ts pour les tests CSP.
 */

import { describe, expect, it } from "vitest";
import nextConfig from "@/next.config";

describe("Static Security Headers (F-078)", () => {
  it("should NOT have Content-Security-Policy in static headers (moved to middleware)", async () => {
    // La CSP est générée dynamiquement dans proxy.ts (avec nonce per-request).
    // Elle ne doit plus figurer dans next.config.ts pour éviter un double-header.
    const config = nextConfig as any;
    if (typeof config.headers === "function") {
      const headersResult = await config.headers();
      const cspHeader = headersResult[0]?.headers?.find(
        (h: any) => h.key === "Content-Security-Policy",
      );
      expect(cspHeader).toBeUndefined();
    }
  });

  it("should prohibit frame embedding (X-Frame-Options: DENY)", async () => {
    // X-Frame-Options: DENY bloque l'inclusion en iframe
    const config = nextConfig as any;
    if (typeof config.headers === "function") {
      const headersResult = await config.headers();
      const xFrameHeader = headersResult[0]?.headers?.find((h: any) => h.key === "X-Frame-Options");
      expect(xFrameHeader?.value).toBe("DENY");
    }
  });

  it("should enforce HSTS (Strict-Transport-Security)", async () => {
    // max-age >= 2 ans (63072000 secondes)
    const config = nextConfig as any;
    if (typeof config.headers === "function") {
      const headersResult = await config.headers();
      const hstsHeader = headersResult[0]?.headers?.find(
        (h: any) => h.key === "Strict-Transport-Security",
      );
      expect(hstsHeader?.value).toContain("max-age=63072000");
      expect(hstsHeader?.value).toContain("includeSubDomains");
    }
  });

  it("should set Referrer-Policy to strict-origin-when-cross-origin", async () => {
    // Pas de referer leak cross-origin
    const config = nextConfig as any;
    if (typeof config.headers === "function") {
      const headersResult = await config.headers();
      const referrerHeader = headersResult[0]?.headers?.find(
        (h: any) => h.key === "Referrer-Policy",
      );
      expect(referrerHeader?.value).toBe("strict-origin-when-cross-origin");
    }
  });

  it("should disable FLoC and respect privacy (Permissions-Policy)", async () => {
    // interest-cohort=() bloque FLoC
    // microphone=(self) permet micro seulement en iframe propre
    const config = nextConfig as any;
    if (typeof config.headers === "function") {
      const headersResult = await config.headers();
      const permissionsHeader = headersResult[0]?.headers?.find(
        (h: any) => h.key === "Permissions-Policy",
      );
      expect(permissionsHeader?.value).toContain("interest-cohort=()");
      expect(permissionsHeader?.value).toContain("camera=()");
      expect(permissionsHeader?.value).toContain("geolocation=()");
    }
  });

  it("should set X-Content-Type-Options to nosniff", async () => {
    // Prévient MIME sniffing attacks
    const config = nextConfig as any;
    if (typeof config.headers === "function") {
      const headersResult = await config.headers();
      const xContentTypeHeader = headersResult[0]?.headers?.find(
        (h: any) => h.key === "X-Content-Type-Options",
      );
      expect(xContentTypeHeader?.value).toBe("nosniff");
    }
  });
});
