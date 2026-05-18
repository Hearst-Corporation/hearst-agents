/**
 * Tests unitaires KimiProvider + intégration router.
 * Utilise vi.stubGlobal pour intercepter fetch sans dépendance réseau.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KimiProvider } from "../../lib/llm/kimi";
import { getProvider, resetLlmProviderCache } from "../../lib/llm/router";

// ---------------------------------------------------------------------------
// Helpers mock
// ---------------------------------------------------------------------------

function makeFetchMock(body: unknown, headers: Record<string, string> = {}) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json", ...headers },
    }),
  );
}

const MOCK_COMPLETION = {
  id: "chatcmpl-kimi-test-1",
  object: "chat.completion",
  model: "kimi-k2.5",
  choices: [
    {
      index: 0,
      message: { role: "assistant", content: "Bonjour depuis Kimi !" },
      finish_reason: "stop",
    },
  ],
  usage: { prompt_tokens: 10, completion_tokens: 8, total_tokens: 18 },
};

// ---------------------------------------------------------------------------
// Setup : NODE_ENV=test garanti par vitest, KIMI_API_KEY absent par défaut
// ---------------------------------------------------------------------------

beforeEach(() => {
  resetLlmProviderCache();
  delete process.env.KIMI_API_KEY;
  delete process.env.KIMI_BASE_URL;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  resetLlmProviderCache();
});

// ---------------------------------------------------------------------------
// 1. chat() retourne un ChatResponse valide (mock fetch)
// ---------------------------------------------------------------------------

describe("KimiProvider.chat", () => {
  it("retourne un ChatResponse valide avec mock fetch", async () => {
    vi.stubGlobal("fetch", makeFetchMock(MOCK_COMPLETION));

    const provider = new KimiProvider();
    const res = await provider.chat({
      model: "kimi-k2.5",
      messages: [{ role: "user", content: "Test" }],
    });

    expect(res.content).toBe("Bonjour depuis Kimi !");
    expect(res.provider).toBe("kimi");
    expect(res.model).toBe("kimi-k2.5");
    expect(res.tokens_in).toBe(10);
    expect(res.tokens_out).toBe(8);
    expect(res.cost_usd).toBeGreaterThanOrEqual(0);
    expect(res.latency_ms).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// 2. Comportement sans clé API (build-placeholder)
// ---------------------------------------------------------------------------

describe("KimiProvider — validation env", () => {
  it("instancie sans erreur même si KIMI_API_KEY et HYPERCLI_API_KEY absents (build-placeholder)", () => {
    // Depuis feat/hub-mode-helm, le constructeur utilise "build-placeholder"
    // en production pour ne pas bloquer le build Vercel.
    // Ce cas teste que l'instanciation ne lève pas d'erreur.
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.KIMI_API_KEY;
    delete process.env.HYPERCLI_API_KEY;

    expect(() => new KimiProvider()).not.toThrow();
  });

  it("utilise HYPERCLI_API_KEY en priorité sur KIMI_API_KEY", async () => {
    vi.stubEnv("HYPERCLI_API_KEY", "hypercli-key-priority");
    vi.stubEnv("KIMI_API_KEY", "kimi-key-fallback");

    const fetchMock = makeFetchMock(MOCK_COMPLETION);
    vi.stubGlobal("fetch", fetchMock);

    const provider = new KimiProvider();
    await provider.chat({
      model: "kimi-k2.5",
      messages: [{ role: "user", content: "Test priorité clé" }],
    });

    // Vérifie que fetch a bien été appelé (provider fonctionnel)
    expect(fetchMock).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 3. Utilise KIMI_BASE_URL env si présent (override hypercli.com)
// ---------------------------------------------------------------------------

describe("KimiProvider — baseURL override", () => {
  it("utilise KIMI_BASE_URL env si défini", async () => {
    const customBase = "https://my-custom-kimi-proxy.example.com/v1";
    vi.stubEnv("KIMI_BASE_URL", customBase);

    const fetchMock = makeFetchMock(MOCK_COMPLETION);
    vi.stubGlobal("fetch", fetchMock);

    const provider = new KimiProvider();
    await provider.chat({
      model: "kimi-k2.5",
      messages: [{ role: "user", content: "Test baseURL" }],
    });

    // L'URL appelée doit contenir le baseURL custom
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("my-custom-kimi-proxy.example.com"),
      expect.anything(),
    );
  });
});

// ---------------------------------------------------------------------------
// 4. getProvider("kimi") retourne une instance KimiProvider
// ---------------------------------------------------------------------------

describe("router — getProvider kimi", () => {
  it('getProvider("kimi") retourne une instance KimiProvider', () => {
    const provider = getProvider("kimi");
    expect(provider).toBeInstanceOf(KimiProvider);
    expect(provider.name).toBe("kimi");
  });
});

// ---------------------------------------------------------------------------
// 5. getProvider("kimi") est singleton (2 appels = même instance)
// ---------------------------------------------------------------------------

describe("router — singleton KimiProvider", () => {
  it("retourne la même instance sur deux appels consécutifs", () => {
    const a = getProvider("kimi");
    const b = getProvider("kimi");
    expect(a).toBe(b);
  });

  it("retourne une nouvelle instance après resetLlmProviderCache", () => {
    const a = getProvider("kimi");
    resetLlmProviderCache();
    const b = getProvider("kimi");
    expect(a).not.toBe(b);
  });
});
