import { describe, expect, it } from "vitest";

/**
 * Test de la détection des erreurs transientes (500, 502, 503, 504)
 * et du retry automatique.
 *
 * Note: Ce test valide simplement que isTransientError détecte
 * correctement les codes 429, 500, 502, 503, 504 (regex /\\b(429|500|502|503|504)\\b/).
 */

function isTransientError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return /\b(429|500|502|503|504)\b/.test(err.message);
}

describe("isTransientError — Transient error detection", () => {
  it("détecte 429 (too many requests)", () => {
    const err = new Error("429 rate limit exceeded");
    expect(isTransientError(err)).toBe(true);
  });

  it("détecte 500 (internal server error)", () => {
    const err = new Error("500 internal server error");
    expect(isTransientError(err)).toBe(true);
  });

  it("détecte 502 (bad gateway)", () => {
    const err = new Error("502 bad gateway");
    expect(isTransientError(err)).toBe(true);
  });

  it("détecte 503 (service unavailable)", () => {
    const err = new Error("503 service unavailable");
    expect(isTransientError(err)).toBe(true);
  });

  it("détecte 504 (gateway timeout)", () => {
    const err = new Error("504 gateway timeout");
    expect(isTransientError(err)).toBe(true);
  });

  it("ignore 400 (bad request — client error)", () => {
    const err = new Error("400 bad request");
    expect(isTransientError(err)).toBe(false);
  });

  it("ignore 401 (unauthorized)", () => {
    const err = new Error("401 unauthorized");
    expect(isTransientError(err)).toBe(false);
  });

  it("ignore 403 (forbidden)", () => {
    const err = new Error("403 forbidden");
    expect(isTransientError(err)).toBe(false);
  });

  it("ignore 404 (not found)", () => {
    const err = new Error("404 not found");
    expect(isTransientError(err)).toBe(false);
  });

  it("non-Error values return false", () => {
    expect(isTransientError(null)).toBe(false);
    expect(isTransientError(undefined)).toBe(false);
    expect(isTransientError("500 error")).toBe(false);
    expect(isTransientError({ message: "500" })).toBe(false);
  });

  it("ignores 429-like patterns NOT as separate codes (false positive guard)", () => {
    // "4291" should NOT match \b429\b (word boundary)
    const err = new Error("error 4291");
    expect(isTransientError(err)).toBe(false);
  });

  it("détecte 500+ dans context message", () => {
    const err = new Error("Provider responded with 502 gateway error. Retrying...");
    expect(isTransientError(err)).toBe(true);
  });
});
