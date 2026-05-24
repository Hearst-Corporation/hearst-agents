import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock logger AVANT l'import du module sous test
vi.mock("@/lib/observability/logger", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  extractRetryAfterMs,
  HARD_THROTTLE_CAP_MS,
  retryWithBackoff,
} from "@/lib/llm/retry-with-backoff";
import { logger } from "@/lib/observability/logger";

// Accélère les timers pour ne pas vraiment attendre les délais de backoff
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// extractRetryAfterMs
// ---------------------------------------------------------------------------

describe("extractRetryAfterMs", () => {
  it("retourne 0 pour une erreur sans Retry-After", () => {
    expect(extractRetryAfterMs(new Error("500 internal server error"))).toBe(0);
  });

  it("parse 'retry-after: 30' (secondes → ms)", () => {
    expect(extractRetryAfterMs(new Error("retry-after: 30"))).toBe(30_000);
  });

  it("extrait retry-after avec espace (retry after 12s)", () => {
    expect(extractRetryAfterMs(new Error("retry after 12s"))).toBe(12_000);
  });

  it("parse 'Retry After 45' (case-insensitive)", () => {
    expect(extractRetryAfterMs(new Error("Retry After 45"))).toBe(45_000);
  });

  it("parse 'retryAfterMs: 120000' (millisecondes directes)", () => {
    expect(extractRetryAfterMs(new Error("retryAfterMs: 120000"))).toBe(120_000);
  });

  it("parse 'after 20 seconds'", () => {
    expect(extractRetryAfterMs(new Error("Please wait, after 20 seconds retry"))).toBe(20_000);
  });

  it("retourne 0 pour une non-Error", () => {
    expect(extractRetryAfterMs(null)).toBe(0);
    expect(extractRetryAfterMs("retry-after: 10")).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// isTransientError — testé via retryWithBackoff (black-box car interne dans K2)
// ---------------------------------------------------------------------------

describe("isTransientError (via retryWithBackoff)", () => {
  it("retente sur 429 (too many requests)", async () => {
    let calls = 0;
    const fn = vi.fn(async () => {
      calls++;
      if (calls < 2) throw new Error("429 rate limit exceeded");
      return "ok";
    });
    const promise = retryWithBackoff(fn, 3);
    await vi.advanceTimersByTimeAsync(5_000);
    await expect(promise).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("retente sur 500, 502, 503, 504", async () => {
    for (const code of [500, 502, 503, 504]) {
      vi.clearAllMocks();
      let calls = 0;
      const fn = vi.fn(async () => {
        calls++;
        if (calls < 2) throw new Error(`${code} error`);
        return "ok";
      });
      const promise = retryWithBackoff(fn, 3);
      await vi.advanceTimersByTimeAsync(5_000);
      await expect(promise).resolves.toBe("ok");
      expect(fn).toHaveBeenCalledTimes(2);
    }
  });

  it("ne retente PAS sur erreurs 4xx (client errors)", async () => {
    for (const code of [400, 401, 403, 404]) {
      const fn = vi.fn(async () => {
        throw new Error(`${code} error`);
      });
      await expect(retryWithBackoff(fn, 3)).rejects.toThrow(`${code}`);
      expect(fn).toHaveBeenCalledTimes(1);
      vi.clearAllMocks();
    }
  });

  it("word boundary guard : 4291 ne doit pas matcher 429", async () => {
    const fn = vi.fn(async () => {
      throw new Error("error 4291");
    });
    await expect(retryWithBackoff(fn, 1)).rejects.toThrow("error 4291");
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// retryWithBackoff — warn structuré HARD_CAP
// ---------------------------------------------------------------------------

describe("retryWithBackoff — warn HARD_THROTTLE_CAP", () => {
  it("loggue warn structuré si hard delay dépasse HARD_THROTTLE_CAP_MS", async () => {
    // retry-after: 120 s = 120 000 ms > 60 000 ms (HARD_THROTTLE_CAP_MS)
    const bigDelay = 120_000;
    let calls = 0;
    const fn = vi.fn(async () => {
      calls++;
      if (calls < 2) throw new Error(`429 too many requests retryAfterMs: ${bigDelay}`);
      return "ok";
    });

    const promise = retryWithBackoff(fn, 3, "anthropic");
    // Avance les timers pour passer le délai cappé (60 s)
    await vi.advanceTimersByTimeAsync(HARD_THROTTLE_CAP_MS + 100);
    const result = await promise;

    expect(result).toBe("ok");
    expect(logger.warn).toHaveBeenCalledOnce();
    expect(logger.warn).toHaveBeenCalledWith(
      {
        provider: "anthropic",
        requestedDelayMs: bigDelay,
        capMs: HARD_THROTTLE_CAP_MS,
      },
      "[router] hard retry-after exceeded HARD_THROTTLE_CAP — capping defensively, prod alert recommandée",
    );
  });

  it("ne loggue PAS warn si hard delay ≤ HARD_THROTTLE_CAP_MS", async () => {
    // retry-after: 30 s = 30 000 ms ≤ 60 000 ms
    const smallDelay = 30_000;
    let calls = 0;
    const fn = vi.fn(async () => {
      calls++;
      if (calls < 2) throw new Error(`429 too many requests retryAfterMs: ${smallDelay}`);
      return "ok";
    });

    const promise = retryWithBackoff(fn, 3, "openai");
    await vi.advanceTimersByTimeAsync(smallDelay + 100);
    const result = await promise;

    expect(result).toBe("ok");
    expect(logger.warn).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// retryWithBackoff — comportement général
// ---------------------------------------------------------------------------

describe("retryWithBackoff — comportement général", () => {
  it("retourne directement si pas d'erreur", async () => {
    const fn = vi.fn(async () => "success");
    const result = await retryWithBackoff(fn);
    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledOnce();
  });

  it("retente sur erreur transiente et réussit à la 2e tentative", async () => {
    let calls = 0;
    const fn = vi.fn(async () => {
      calls++;
      if (calls < 2) throw new Error("502 bad gateway");
      return "ok";
    });

    const promise = retryWithBackoff(fn, 3);
    await vi.advanceTimersByTimeAsync(2_000);
    const result = await promise;
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("ne retente PAS sur erreur non-transiente (400)", async () => {
    const fn = vi.fn(async () => {
      throw new Error("400 bad request");
    });
    await expect(retryWithBackoff(fn, 3)).rejects.toThrow("400 bad request");
    expect(fn).toHaveBeenCalledOnce();
  });

  it("propage l'erreur après épuisement des retries (maxRetries transients)", async () => {
    const fn = vi.fn(async () => {
      throw new Error("503 service unavailable");
    });

    let caughtError: Error | null = null;
    const promise = retryWithBackoff(fn, 2).catch((e) => {
      caughtError = e;
    });

    // 3 tentatives au total (1 initial + 2 retries), délais exp 1 s + 2 s
    await vi.advanceTimersByTimeAsync(10_000);
    await promise;

    expect(caughtError).toBeInstanceOf(Error);
    expect((caughtError as unknown as Error).message).toContain("503 service unavailable");
    expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it("cap le delay à HARD_THROTTLE_CAP_MS même sans provider arg", async () => {
    const bigDelay = 200_000;
    let calls = 0;
    const fn = vi.fn(async () => {
      calls++;
      if (calls < 2) throw new Error(`429 retryAfterMs: ${bigDelay}`);
      return "capped";
    });

    const promise = retryWithBackoff(fn, 3); // pas de provider
    await vi.advanceTimersByTimeAsync(HARD_THROTTLE_CAP_MS + 100);
    const result = await promise;
    expect(result).toBe("capped");
    // warn loggué sans provider (undefined)
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ requestedDelayMs: bigDelay, capMs: HARD_THROTTLE_CAP_MS }),
      expect.any(String),
    );
  });
});
