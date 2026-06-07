import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// F6 — verrou rate-limit. RATE_MAX est lu au chargement du module (comme le
// timeout) → on le pose AVANT l'import via vi.hoisted, à une valeur basse.
const { execute } = vi.hoisted(() => {
  process.env.COMPOSIO_RATE_MAX = "3";
  process.env.COMPOSIO_RATE_WINDOW_MS = "60000";
  return { execute: vi.fn() };
});

vi.mock("@composio/core", () => {
  class Composio {
    tools = { execute, list: vi.fn() };
    toolkits = { list: vi.fn(), get: vi.fn(), authorize: vi.fn() };
    connectedAccounts = { list: vi.fn(), delete: vi.fn() };
    create = vi.fn();
  }
  return { Composio };
});

import { executeComposioAction, resetComposioClient } from "@/lib/connectors/composio";

describe("Composio rate-limit (F6) — backpressure par userId", () => {
  beforeEach(() => {
    resetComposioClient();
    execute.mockReset();
    execute.mockResolvedValue({ ok: true });
    process.env.COMPOSIO_API_KEY = "ak_test";
  });
  afterEach(() => {
    delete process.env.COMPOSIO_API_KEY;
    resetComposioClient();
  });

  it("au-delà du quota (3/fenêtre) → RATE_LIMITED, SDK non appelé", async () => {
    // userId unique pour ne pas hériter d'appels d'autres tests (Map process-local).
    const entityId = "ratelimit-user-A";
    for (let i = 0; i < 3; i++) {
      const r = await executeComposioAction({ action: "GMAIL_FETCH_EMAILS", entityId, params: {} });
      expect(r.ok).toBe(true);
    }
    const blocked = await executeComposioAction({
      action: "GMAIL_FETCH_EMAILS",
      entityId,
      params: {},
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.errorCode).toBe("RATE_LIMITED");
    // Le 4e n'a JAMAIS touché le SDK (protège la clé partagée).
    expect(execute).toHaveBeenCalledTimes(3);
  });

  it("le quota est isolé par userId", async () => {
    const r1 = await executeComposioAction({
      action: "GMAIL_FETCH_EMAILS",
      entityId: "ratelimit-user-B",
      params: {},
    });
    const r2 = await executeComposioAction({
      action: "GMAIL_FETCH_EMAILS",
      entityId: "ratelimit-user-C",
      params: {},
    });
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
  });
});
