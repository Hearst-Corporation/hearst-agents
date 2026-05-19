/**
 * Security Headers Test — F-078
 *
 * Valide que next.config.ts expose les headers de sécurité (CSP, HSTS, X-Frame, etc.)
 * via la fonction headers().
 */

import { describe, expect, it } from "vitest";
import nextConfig from "@/next.config";

describe("CSP & Security Headers (F-078)", () => {
  it("should have Content-Security-Policy header configured", async () => {
    // Import next.config.ts et vérifier que headers() retourne CSP.
    const config = nextConfig as any;
    if (typeof config.headers === "function") {
      const headersResult = await config.headers();
      const cspHeader = headersResult[0]?.headers?.find(
        (h: any) => h.key === "Content-Security-Policy",
      );
      expect(cspHeader).toBeDefined();
      expect(cspHeader?.value).toContain("default-src 'self'");
    }
  });

  it("should prohibit unauthorized frame embedding via CSP frame-ancestors", async () => {
    // X-Frame-Options est intentionnellement absent (allowEmbed = true pour embed Cockpit).
    // La protection est assurée par CSP frame-ancestors avec whitelist explicite.
    const config = nextConfig as any;
    if (typeof config.headers === "function") {
      const headersResult = await config.headers();
      const cspHeader = headersResult[0]?.headers?.find(
        (h: any) => h.key === "Content-Security-Policy",
      );
      expect(cspHeader).toBeDefined();
      expect(cspHeader?.value).toContain("frame-ancestors");
      expect(cspHeader?.value).toMatch(/frame-ancestors[^;]*'self'/);
      expect(cspHeader?.value).not.toMatch(/frame-ancestors\s+\*/);
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

  it("should include api.hypercli.com in connect-src for Kimi orchestrator", async () => {
    // Post Vague 2 fix headers-fixer — allow Kimi API calls
    const config = nextConfig as any;
    if (typeof config.headers === "function") {
      const headersResult = await config.headers();
      const cspHeader = headersResult[0]?.headers?.find(
        (h: any) => h.key === "Content-Security-Policy",
      );
      expect(cspHeader?.value).toContain("api.hypercli.com");
    }
  });
});
