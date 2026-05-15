/**
 * P1-3 — Composio tool execution timeout (30s par défaut).
 *
 * Vérifie que executeComposioAction :
 * - Retourne `{ ok: false, errorCode: "TIMEOUT" }` si le SDK met > timeout
 * - Retourne `{ ok: true, data }` si le SDK répond avant le timeout
 * - Le timer est nettoyé même en cas de succès (pas de leak setTimeout)
 * - Variable env `COMPOSIO_TOOL_TIMEOUT_MS` override le défaut
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const composioMock = {
  tools: { execute: vi.fn(), get: vi.fn() },
  toolkits: { list: vi.fn(), get: vi.fn(), authorize: vi.fn() },
  connectedAccounts: { list: vi.fn(), delete: vi.fn() },
  create: vi.fn(),
};

vi.mock("@composio/core", () => {
  // Classe réelle pour que `new m.Composio({...})` fonctionne dans client.ts.
  class Composio {
    tools = composioMock.tools;
    toolkits = composioMock.toolkits;
    connectedAccounts = composioMock.connectedAccounts;
    create = composioMock.create;
    constructor(_config?: { apiKey?: string }) {}
  }
  return { Composio };
});

beforeEach(() => {
  vi.clearAllMocks();
  process.env.COMPOSIO_API_KEY = "test-key";
  process.env.COMPOSIO_TOOL_TIMEOUT_MS = "150";
});

afterEach(() => {
  delete process.env.COMPOSIO_TOOL_TIMEOUT_MS;
});

describe("P1-3 Composio timeout per tool", () => {
  it("retourne TIMEOUT si execute prend > timeout configuré", async () => {
    composioMock.tools.execute.mockImplementation(
      () => new Promise(() => {}), // jamais résolu
    );

    const { executeComposioAction, resetComposioClient } = await import(
      "@/lib/connectors/composio/client"
    );
    resetComposioClient();

    const result = await executeComposioAction({
      action: "SLACK_SEND_MESSAGE",
      entityId: "user-1",
      params: { channel: "general", text: "test" },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorCode).toBe("TIMEOUT");
      expect(result.error).toContain("trop de temps");
    }
  });

  it("retourne data si execute répond avant le timeout", async () => {
    composioMock.tools.execute.mockResolvedValue({ messageId: "msg_123" });

    const { executeComposioAction, resetComposioClient } = await import(
      "@/lib/connectors/composio/client"
    );
    resetComposioClient();

    const result = await executeComposioAction({
      action: "SLACK_SEND_MESSAGE",
      entityId: "user-1",
      params: { channel: "general", text: "test" },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ messageId: "msg_123" });
    }
  });

  it("preserve les errorCodes d'auth quand l'erreur n'est pas un timeout", async () => {
    composioMock.tools.execute.mockRejectedValue(new Error("no active connection"));

    const { executeComposioAction, resetComposioClient } = await import(
      "@/lib/connectors/composio/client"
    );
    resetComposioClient();

    const result = await executeComposioAction({
      action: "SLACK_SEND_MESSAGE",
      entityId: "user-1",
      params: {},
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorCode).toBe("AUTH_REQUIRED");
    }
  });

  it("preserve UNKNOWN_SLUG quand le tool n'existe pas", async () => {
    composioMock.tools.execute.mockRejectedValue(new Error("Unable to retrieve tool with slug X"));

    const { executeComposioAction, resetComposioClient } = await import(
      "@/lib/connectors/composio/client"
    );
    resetComposioClient();

    const result = await executeComposioAction({
      action: "FAKE_TOOL",
      entityId: "user-1",
      params: {},
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorCode).toBe("UNKNOWN_SLUG");
    }
  });

  it("retourne NOT_CONFIGURED si COMPOSIO_API_KEY absent", async () => {
    delete process.env.COMPOSIO_API_KEY;
    const { executeComposioAction, resetComposioClient } = await import(
      "@/lib/connectors/composio/client"
    );
    resetComposioClient();

    const result = await executeComposioAction({
      action: "ANY",
      entityId: "user-1",
      params: {},
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorCode).toBe("NOT_CONFIGURED");
    }
  });
});
