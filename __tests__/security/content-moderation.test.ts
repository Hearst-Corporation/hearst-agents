/**
 * P0-5 — Content moderation pre-enqueue.
 *
 * Vérifie que `ensureContentAllowed` :
 * - Bloque le contenu flaggé par OpenAI Moderation
 * - Fail-soft (allow) si OPENAI_API_KEY absent
 * - Fail-soft (allow) si l'API down / timeout
 * - Catégorise correctement
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

beforeEach(() => {
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  // L'env peut leaker depuis un autre test file (vitest partage process.env).
  // On force un état propre AVANT chaque test pour que le cas "no_api_key" soit fiable.
  delete process.env.OPENAI_API_KEY;
});

afterEach(() => {
  fetchMock.mockReset();
  delete process.env.OPENAI_API_KEY;
});

describe("P0-5 moderateContent / ensureContentAllowed", () => {
  it("retourne flagged=false sans OPENAI_API_KEY (fail-soft)", async () => {
    const { moderateContent } = await import("@/lib/moderation/openai");
    const result = await moderateContent("anything");
    expect(result.flagged).toBe(false);
    expect(result.source).toBe("skipped");
    expect(result.reason).toBe("no_api_key");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("bloque un contenu flaggé par l'API OpenAI", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "modr-test",
        model: "omni-moderation-latest",
        results: [
          {
            flagged: true,
            categories: { violence: true, hate: false, sexual: true },
            category_scores: { violence: 0.92, hate: 0.1, sexual: 0.81 },
          },
        ],
      }),
    });

    const { ensureContentAllowed } = await import("@/lib/moderation/openai");
    const msg = await ensureContentAllowed("contenu offensant");
    expect(msg).not.toBeNull();
    expect(msg).toContain("violence");
    expect(msg).toContain("sexual");
  });

  it("laisse passer un contenu non flaggé", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "modr-test",
        model: "omni-moderation-latest",
        results: [
          {
            flagged: false,
            categories: {},
            category_scores: {},
          },
        ],
      }),
    });

    const { ensureContentAllowed } = await import("@/lib/moderation/openai");
    const msg = await ensureContentAllowed("Lis ce paragraphe normal sur les chats");
    expect(msg).toBeNull();
  });

  it("fail-soft sur HTTP 5xx (laisse passer + log)", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({}),
    });

    const { moderateContent } = await import("@/lib/moderation/openai");
    const result = await moderateContent("texte");
    expect(result.flagged).toBe(false);
    expect(result.source).toBe("error");
    expect(result.reason).toContain("503");
  });

  it("fail-soft sur exception réseau (laisse passer)", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    fetchMock.mockRejectedValueOnce(new Error("network down"));

    const { moderateContent } = await import("@/lib/moderation/openai");
    const result = await moderateContent("texte");
    expect(result.flagged).toBe(false);
    expect(result.source).toBe("error");
    expect(result.reason).toContain("network down");
  });

  it("skip si texte vide (pas d'appel API)", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    const { moderateContent } = await import("@/lib/moderation/openai");
    const result = await moderateContent("   ");
    expect(result.flagged).toBe(false);
    expect(result.source).toBe("skipped");
    expect(result.reason).toBe("empty_input");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("extrait le maxScore parmi les catégories flaggées", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "modr-test",
        model: "omni-moderation-latest",
        results: [
          {
            flagged: true,
            categories: { violence: true, hate: true },
            category_scores: { violence: 0.65, hate: 0.92 },
          },
        ],
      }),
    });

    const { moderateContent } = await import("@/lib/moderation/openai");
    const result = await moderateContent("test");
    expect(result.maxScore).toBe(0.92);
  });
});
