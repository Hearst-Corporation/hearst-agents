import { describe, expect, it, vi } from "vitest";
import {
  extractRetryAfterMs,
  HARD_THROTTLE_CAP_MS,
  isTransientError,
  retryWithBackoff,
  SOFT_THROTTLE_CAP_MS,
} from "../../lib/llm/retry-with-backoff";

// ---------------------------------------------------------------------------
// isTransientError
// ---------------------------------------------------------------------------

describe("isTransientError", () => {
  it("détecte 429 (too many requests)", () => {
    expect(isTransientError(new Error("429 rate limit exceeded"))).toBe(true);
  });

  it("détecte 500 (internal server error)", () => {
    expect(isTransientError(new Error("500 internal server error"))).toBe(true);
  });

  it("détecte 502, 503, 504", () => {
    expect(isTransientError(new Error("502 bad gateway"))).toBe(true);
    expect(isTransientError(new Error("503 service unavailable"))).toBe(true);
    expect(isTransientError(new Error("504 gateway timeout"))).toBe(true);
  });

  it("ignore les erreurs 4xx (client errors)", () => {
    expect(isTransientError(new Error("400 bad request"))).toBe(false);
    expect(isTransientError(new Error("401 unauthorized"))).toBe(false);
    expect(isTransientError(new Error("403 forbidden"))).toBe(false);
    expect(isTransientError(new Error("404 not found"))).toBe(false);
  });

  it("retourne false pour les valeurs non-Error", () => {
    expect(isTransientError(null)).toBe(false);
    expect(isTransientError(undefined)).toBe(false);
    expect(isTransientError("500 error")).toBe(false);
    expect(isTransientError({ message: "500" })).toBe(false);
  });

  it("word boundary guard : 4291 ne doit pas matcher 429", () => {
    expect(isTransientError(new Error("error 4291"))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// extractRetryAfterMs
// ---------------------------------------------------------------------------

describe("extractRetryAfterMs", () => {
  it("extrait retry-after en secondes", () => {
    expect(extractRetryAfterMs(new Error("retry-after: 30"))).toBe(30_000);
  });

  it("extrait retry-after avec espace", () => {
    expect(extractRetryAfterMs(new Error("retry after 12s"))).toBe(12_000);
  });

  it("extrait retry-after en ms", () => {
    expect(extractRetryAfterMs(new Error("retry-after: 500ms"))).toBe(500);
  });

  it("plafonne au HARD_THROTTLE_CAP_MS", () => {
    const result = extractRetryAfterMs(new Error("retry-after: 3600s"));
    expect(result).toBe(HARD_THROTTLE_CAP_MS);
  });

  it("retourne 0 si non trouvé", () => {
    expect(extractRetryAfterMs(new Error("some random error"))).toBe(0);
    expect(extractRetryAfterMs(null)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// retryWithBackoff
// ---------------------------------------------------------------------------

describe("retryWithBackoff", () => {
  it("retourne le résultat immédiatement si succès du premier coup", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await retryWithBackoff(fn);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retente sur erreur transiente et retourne le résultat au 2e appel", async () => {
    vi.useFakeTimers();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("503 service unavailable"))
      .mockResolvedValue("recovered");

    const promise = retryWithBackoff(fn, 3);
    // Avancer le timer pour le backoff du premier retry (1000ms base)
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("propage l'erreur si non-transiente (4xx)", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("401 unauthorized"));
    await expect(retryWithBackoff(fn, 3)).rejects.toThrow("401 unauthorized");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("propage l'erreur après épuisement des retries (maxRetries transients)", async () => {
    vi.useFakeTimers();
    const fn = vi.fn().mockRejectedValue(new Error("502 bad gateway"));

    const resultPromise = retryWithBackoff(fn, 2).catch((e) => e);
    await vi.runAllTimersAsync();

    const err = await resultPromise;
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toContain("502 bad gateway");
    expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    vi.useRealTimers();
  });

  it("plafonne le délai au SOFT_THROTTLE_CAP_MS (backoff exponentiel)", async () => {
    vi.useFakeTimers();
    const delays: number[] = [];
    const realSetTimeout = globalThis.setTimeout;

    // Spy sur setTimeout pour capturer les délais
    const spy = vi.spyOn(globalThis, "setTimeout").mockImplementation((fn, delay, ...args) => {
      delays.push(delay as number);
      return realSetTimeout(fn, 0, ...args); // Exécuter immédiatement en test
    });

    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("500 error"))
      .mockRejectedValueOnce(new Error("500 error"))
      .mockRejectedValueOnce(new Error("500 error"))
      .mockResolvedValue("ok");

    const promise = retryWithBackoff(fn, 5);
    await vi.runAllTimersAsync();
    await promise;

    for (const d of delays) {
      expect(d).toBeLessThanOrEqual(SOFT_THROTTLE_CAP_MS);
    }

    spy.mockRestore();
    vi.useRealTimers();
  });
});
