import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LLMRateLimiter } from "../rate-limiter";

describe("LLMRateLimiter — recordHeaders + shouldThrottle (Anthropic)", () => {
  let rl: LLMRateLimiter;

  beforeEach(() => {
    rl = new LLMRateLimiter();
  });

  it("retourne pas de throttle quand aucun header n'a été enregistré", () => {
    expect(rl.shouldThrottle("anthropic")).toEqual({ throttle: false });
    expect(rl.getNextDelay("anthropic")).toBe(0);
  });

  it("parse les headers Anthropic et déclenche un throttle quand requestsRemaining=0", () => {
    const resetIso = new Date(Date.now() + 30_000).toISOString();
    rl.recordHeaders("anthropic", {
      "anthropic-ratelimit-requests-limit": "100",
      "anthropic-ratelimit-requests-remaining": "0",
      "anthropic-ratelimit-requests-reset": resetIso,
    });

    const decision = rl.shouldThrottle("anthropic");
    expect(decision.throttle).toBe(true);
    expect(decision.reasonMs).toBeGreaterThan(0);
    expect(decision.reasonMs).toBeLessThanOrEqual(30_000);
  });

  it("déclenche un throttle proactif court quand requestsRemaining < 5", () => {
    const resetIso = new Date(Date.now() + 60_000).toISOString();
    rl.recordHeaders("anthropic", {
      "anthropic-ratelimit-requests-limit": "100",
      "anthropic-ratelimit-requests-remaining": "2",
      "anthropic-ratelimit-requests-reset": resetIso,
    });

    const decision = rl.shouldThrottle("anthropic");
    expect(decision.throttle).toBe(true);
    // Capé à 1000ms
    expect(decision.reasonMs).toBeLessThanOrEqual(1000);
  });

  it("ne throttle pas quand requestsRemaining élevé", () => {
    const resetIso = new Date(Date.now() + 60_000).toISOString();
    rl.recordHeaders("anthropic", {
      "anthropic-ratelimit-requests-limit": "100",
      "anthropic-ratelimit-requests-remaining": "50",
      "anthropic-ratelimit-requests-reset": resetIso,
    });

    expect(rl.shouldThrottle("anthropic")).toEqual({ throttle: false });
  });

  it("respecte retry-after en priorité (sur 429)", () => {
    rl.recordHeaders("anthropic", {
      "retry-after": "5",
    });

    const decision = rl.shouldThrottle("anthropic");
    expect(decision.throttle).toBe(true);
    expect(decision.reasonMs).toBeGreaterThan(4500);
    expect(decision.reasonMs).toBeLessThanOrEqual(5000);
  });
});

describe("LLMRateLimiter — recordHeaders + shouldThrottle (OpenAI)", () => {
  let rl: LLMRateLimiter;

  beforeEach(() => {
    rl = new LLMRateLimiter();
  });

  it("parse une durée OpenAI composite '1s500ms'", () => {
    rl.recordHeaders("openai", {
      "x-ratelimit-limit-requests": "60",
      "x-ratelimit-remaining-requests": "0",
      "x-ratelimit-reset-requests": "1s500ms",
    });

    const decision = rl.shouldThrottle("openai");
    expect(decision.throttle).toBe(true);
    expect(decision.reasonMs).toBeGreaterThan(0);
    expect(decision.reasonMs).toBeLessThanOrEqual(1500);
  });

  it("parse une durée OpenAI fractionnaire '12.4s'", () => {
    rl.recordHeaders("openai", {
      "x-ratelimit-limit-requests": "60",
      "x-ratelimit-remaining-requests": "0",
      "x-ratelimit-reset-requests": "12.4s",
    });

    const decision = rl.shouldThrottle("openai");
    expect(decision.throttle).toBe(true);
    expect(decision.reasonMs).toBeGreaterThan(0);
    expect(decision.reasonMs).toBeLessThanOrEqual(12_400);
  });

  it("ignore une durée vide ou '0'", () => {
    rl.recordHeaders("openai", {
      "x-ratelimit-limit-requests": "60",
      "x-ratelimit-remaining-requests": "60",
      "x-ratelimit-reset-requests": "0",
    });

    expect(rl.shouldThrottle("openai")).toEqual({ throttle: false });
  });

  it("déclenche un throttle quand tokensRemaining < 1000", () => {
    rl.recordHeaders("openai", {
      "x-ratelimit-limit-tokens": "100000",
      "x-ratelimit-remaining-tokens": "500",
      "x-ratelimit-reset-tokens": "30s",
    });

    const decision = rl.shouldThrottle("openai");
    expect(decision.throttle).toBe(true);
    expect(decision.reasonMs).toBeLessThanOrEqual(1000);
  });

  it("supporte un Headers Web API", () => {
    const h = new Headers();
    h.set("x-ratelimit-limit-requests", "60");
    h.set("x-ratelimit-remaining-requests", "0");
    h.set("x-ratelimit-reset-requests", "2s");

    rl.recordHeaders("openai", h);

    const decision = rl.shouldThrottle("openai");
    expect(decision.throttle).toBe(true);
  });
});

describe("LLMRateLimiter — edge cases", () => {
  let rl: LLMRateLimiter;

  beforeEach(() => {
    rl = new LLMRateLimiter();
  });

  it("ignore silencieusement un provider inconnu (pas de headers reconnus)", () => {
    rl.recordHeaders("custom-provider", {
      "x-totally-unrelated": "42",
    });

    expect(rl.shouldThrottle("custom-provider")).toEqual({ throttle: false });
    expect(rl.getProviderLimit("custom-provider")).toBeUndefined();
  });

  it("retry-after expiré → plus de throttle", () => {
    vi.useFakeTimers();
    try {
      const start = Date.now();
      vi.setSystemTime(start);

      rl.recordHeaders("openai", { "retry-after": "1" });
      expect(rl.shouldThrottle("openai").throttle).toBe(true);

      // Avance de 2s — retry-after expiré
      vi.setSystemTime(start + 2000);
      expect(rl.shouldThrottle("openai")).toEqual({ throttle: false });
    } finally {
      vi.useRealTimers();
    }
  });

  it("getNextDelay retourne 0 quand pas de throttle", () => {
    expect(rl.getNextDelay("anthropic")).toBe(0);
  });

  it("ne casse pas avec un retry-after non-numérique invalide", () => {
    rl.recordHeaders("openai", { "retry-after": "garbage-value" });
    expect(rl.shouldThrottle("openai")).toEqual({ throttle: false });
  });

  it("conserve l'API existante checkLimit/recordCall (non-régression)", () => {
    expect(() => rl.checkLimit("user-1")).not.toThrow();
    expect(() => rl.recordCall("user-1", 100)).not.toThrow();
    expect(rl.getStats().userCount).toBe(1);
  });
});

describe("LLMRateLimiter — log debounce", () => {
  let rl: LLMRateLimiter;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    rl = new LLMRateLimiter();
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("log throttle au plus 1 fois par seconde par provider", () => {
    rl.recordHeaders("openai", {
      "x-ratelimit-limit-requests": "60",
      "x-ratelimit-remaining-requests": "0",
      "x-ratelimit-reset-requests": "10s",
    });

    rl.shouldThrottle("openai");
    rl.shouldThrottle("openai");
    rl.shouldThrottle("openai");

    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});
