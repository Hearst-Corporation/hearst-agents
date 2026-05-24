/**
 * CSP Nonce Helper Test — F-078-nonce
 *
 * Valide que generateNonce() produit des valeurs cryptographiquement aléatoires
 * valides pour une utilisation comme nonce CSP, et que buildCsp() génère une
 * directive Content-Security-Policy cohérente avec 'strict-dynamic'.
 */

import { describe, expect, it } from "vitest";
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
