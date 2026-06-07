/**
 * Tests unitaires — lib/connectors/composio/tool-router.ts
 *
 * Vérifie :
 *   1. resolveToolRouterSession retourne la session quand composio.create() réussit
 *   2. Le cache évite un 2e appel composio.create() pour le même userId
 *   3. Fail-soft : si composio.create() throw, retourne null sans propager
 *   4. Fail-soft : si mcp.url absent dans la réponse, retourne null
 *   5. Fail-soft : si Composio n'est pas configuré (getComposio→null), retourne null
 *   6. resetToolRouterCache() vide le cache → prochain appel rappelle composio.create()
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock @composio/core avant tout import du module testé ──────────────────
const createMock = vi.fn();

vi.mock("@composio/core", () => {
  class Composio {
    tools = { execute: vi.fn(), get: vi.fn() };
    toolkits = { list: vi.fn(), get: vi.fn(), authorize: vi.fn() };
    connectedAccounts = { list: vi.fn(), delete: vi.fn() };
    create = createMock;
  }
  return { Composio };
});

// Mock client.ts : on réexporte getComposio depuis le mock pour contrôler le retour
vi.mock("@/lib/connectors/composio/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/connectors/composio/client")>();
  return {
    ...actual,
    // getComposio est overridé par chaque test via resetComposioClient + env vars
  };
});

import { resetComposioClient } from "@/lib/connectors/composio/client";
import {
  resetToolRouterCache,
  resolveToolRouterSession,
} from "@/lib/connectors/composio/tool-router";

describe("resolveToolRouterSession", () => {
  beforeEach(() => {
    resetToolRouterCache();
    resetComposioClient();
    createMock.mockReset();
    process.env.COMPOSIO_API_KEY = "ak_test_router";
  });

  afterEach(() => {
    delete process.env.COMPOSIO_API_KEY;
    resetComposioClient();
    resetToolRouterCache();
  });

  it("retourne une session valide quand composio.create() réussit avec mcp.url", async () => {
    createMock.mockResolvedValueOnce({
      sessionId: "sess-abc",
      mcp: {
        type: "sse",
        url: "https://mcp.composio.dev/sse/user-1",
        headers: { Authorization: "Bearer tk-123" },
      },
    });

    const session = await resolveToolRouterSession("user-1");

    expect(session).not.toBeNull();
    expect(session?.sessionId).toBe("sess-abc");
    expect(session?.mcpUrl).toBe("https://mcp.composio.dev/sse/user-1");
    expect(session?.headers).toEqual({ Authorization: "Bearer tk-123" });
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock).toHaveBeenCalledWith("user-1");
  });

  it("utilise le cache pour le 2e appel avec le même userId (no double-create)", async () => {
    createMock.mockResolvedValue({
      sessionId: "sess-cache",
      mcp: { type: "sse", url: "https://mcp.composio.dev/sse/user-2", headers: {} },
    });

    const s1 = await resolveToolRouterSession("user-2");
    const s2 = await resolveToolRouterSession("user-2");

    expect(createMock).toHaveBeenCalledTimes(1); // une seule création
    expect(s1).toBe(s2); // même référence (objet mis en cache)
  });

  it("appelle create() à nouveau pour un userId différent (cache par userId)", async () => {
    createMock.mockResolvedValue({
      sessionId: "sess-x",
      mcp: { type: "sse", url: "https://mcp.composio.dev/sse/user-x", headers: {} },
    });

    await resolveToolRouterSession("user-a");
    await resolveToolRouterSession("user-b");

    expect(createMock).toHaveBeenCalledTimes(2);
    expect(createMock).toHaveBeenNthCalledWith(1, "user-a");
    expect(createMock).toHaveBeenNthCalledWith(2, "user-b");
  });

  it("fail-soft : composio.create() throw → retourne null sans propager", async () => {
    createMock.mockRejectedValueOnce(new Error("Network error"));

    await expect(resolveToolRouterSession("user-err")).resolves.toBeNull();
  });

  it("fail-soft : mcp.url absent dans la réponse → retourne null", async () => {
    createMock.mockResolvedValueOnce({
      sessionId: "sess-no-url",
      // mcp.url absent
    });

    await expect(resolveToolRouterSession("user-nourl")).resolves.toBeNull();
  });

  it("fail-soft : Composio non configuré (pas de COMPOSIO_API_KEY) → retourne null", async () => {
    delete process.env.COMPOSIO_API_KEY;
    resetComposioClient();

    await expect(resolveToolRouterSession("user-nokey")).resolves.toBeNull();
    expect(createMock).not.toHaveBeenCalled();
  });

  it("accepte url racine (sans mcp) si mcp absent mais url présent", async () => {
    createMock.mockResolvedValueOnce({
      sessionId: "sess-root",
      url: "https://mcp.composio.dev/sse/user-root",
      // mcp absent — fallback sur result.url
    });

    const session = await resolveToolRouterSession("user-root");
    expect(session?.mcpUrl).toBe("https://mcp.composio.dev/sse/user-root");
    expect(session?.headers).toEqual({}); // headers vides par défaut
  });

  it("resetToolRouterCache vide le cache et force un nouvel appel composio.create()", async () => {
    createMock.mockResolvedValue({
      sessionId: "sess-reset",
      mcp: { type: "sse", url: "https://mcp.composio.dev/sse/user-reset", headers: {} },
    });

    await resolveToolRouterSession("user-reset");
    resetToolRouterCache();
    await resolveToolRouterSession("user-reset");

    expect(createMock).toHaveBeenCalledTimes(2); // forcé après reset
  });
});
