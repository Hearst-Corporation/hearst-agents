/**
 * Connections invariants — write-guard, formatActionPreview, discovery cache, initiateConnection.
 *
 * Couvre :
 *  1. isWriteAction : "GMAIL_SEND_EMAIL" → true
 *  2. isWriteAction : "GMAIL_DELETE_MESSAGE" → true
 *  3. isWriteAction : "GMAIL_LIST_MESSAGES" → false
 *  4. isWriteAction : "SLACK_GET_CHANNEL" → false
 *  5. formatActionPreview footer : contient "confirmer"
 *  6. Discovery cache ne cache pas [] (résultat vide)
 *  7. initiateConnection appelle invalidateUserDiscovery
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks hoistés
// ─────────────────────────────────────────────────────────────────────────────

const m = vi.hoisted(() => ({
  // composio client — commun à tous les tests
  getComposio: vi.fn(),
  isComposioConfigured: vi.fn(),
  // invalidateUserDiscovery — appelé par connections.ts
  invalidateUserDiscovery: vi.fn(),
  // listConnections — appelé par discovery.ts
  listConnections: vi.fn(),
}));

// Mock le client composio (utilisé par discovery + connections)
vi.mock("@/lib/connectors/composio/client", () => ({
  getComposio: m.getComposio,
  isComposioConfigured: m.isComposioConfigured,
}));

// Mock uniquement invalidateUserDiscovery dans discovery (test 6 utilise le vrai module,
// test 7 a besoin que connections.ts appelle notre mock)
vi.mock("@/lib/connectors/composio/discovery", () => ({
  invalidateUserDiscovery: m.invalidateUserDiscovery,
  resetDiscoveryCache: vi.fn(),
  getToolsForUser: vi.fn(),
}));

// Mock listConnections pour éviter les appels réseau dans les tests discovery
vi.mock("@/lib/connectors/composio/connections", () => ({
  listConnections: m.listConnections,
  initiateConnection: vi.fn(),
  disconnectAccount: vi.fn(),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Imports (après mocks)
// ─────────────────────────────────────────────────────────────────────────────

import { isWriteAction, formatActionPreview } from "@/lib/connectors/composio/write-guard";

// ─────────────────────────────────────────────────────────────────────────────
// Tests 1-4 : isWriteAction
// ─────────────────────────────────────────────────────────────────────────────

describe("isWriteAction — WRITE_SEGMENTS", () => {
  it('"GMAIL_SEND_EMAIL" → true (contient _SEND_)', () => {
    expect(isWriteAction("GMAIL_SEND_EMAIL")).toBe(true);
  });

  it('"GMAIL_DELETE_MESSAGE" → true (contient _DELETE_)', () => {
    expect(isWriteAction("GMAIL_DELETE_MESSAGE")).toBe(true);
  });

  it('"GMAIL_LIST_MESSAGES" → false (lecture seule)', () => {
    expect(isWriteAction("GMAIL_LIST_MESSAGES")).toBe(false);
  });

  it('"SLACK_GET_CHANNEL" → false (lecture seule)', () => {
    expect(isWriteAction("SLACK_GET_CHANNEL")).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 5 : formatActionPreview footer "confirmer"
// ─────────────────────────────────────────────────────────────────────────────

describe("formatActionPreview", () => {
  it('footer contient "confirmer"', () => {
    const out = formatActionPreview("SLACK_SEND_MESSAGE", {
      channel: "#dev",
      text: "hello",
    });
    expect(out.toLowerCase()).toContain("confirmer");
  });

  it("surface les paramètres prominent (channel, text) dans le draft", () => {
    const out = formatActionPreview("SLACK_SEND_MESSAGE", {
      channel: "#dev",
      text: "hello",
    });
    expect(out).toContain("#dev");
    expect(out).toContain("hello");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 6 : discovery cache ne cache pas []
//
// On importe directement getToolsForUser depuis le vrai module via un import
// dynamique dans le test, en s'assurant que les conditions "pas d'actifs" sont
// réunies. Le module `discovery` est mocké globalement — on teste donc le
// comportement via la vraie logique du cache dans discovery.ts.
//
// Stratégie : puisque le module est mocké, on teste la propriété du cache
// directement en inspectant l'implémentation réelle via resetDiscoveryCache +
// un appel au vrai module dans un test isolé.
//
// Simplification : on vérifie que le comportement de "ne pas cacher un []"
// est implémenté dans le source, en le testant via un mock de listConnections
// qui compte les appels.
// ─────────────────────────────────────────────────────────────────────────────

describe("discovery cache — ne cache pas les résultats vides", () => {
  it("getToolsForUser : listConnections appelé à chaque requête quand résultat vide", async () => {
    // On importe le vrai module discovery (pas le mock global) en
    // contournant le module registry avec un import dynamique depuis
    // le chemin réel du fichier. Le mock de `client` et `connections`
    // restera actif car ces modules sont déjà mockés.
    //
    // Note : dans vitest v4, vi.isolateModules n'est pas disponible.
    // On utilise donc le mécanisme de mock global en combinaison avec
    // vi.importActual pour accéder à la logique réelle.

    // Utiliser vi.importActual pour importer le vrai module discovery
    const realDiscovery = await vi.importActual<typeof import("@/lib/connectors/composio/discovery")>(
      "@/lib/connectors/composio/discovery",
    );

    const { resetDiscoveryCache, getToolsForUser } = realDiscovery;

    // Configurer les mocks nécessaires à getToolsForUser
    m.getComposio.mockResolvedValue({
      tools: {
        get: vi.fn().mockResolvedValue([]),
      },
    });

    // listConnections retourne 0 comptes actifs → tools = [] → pas de cache
    let callCount = 0;
    m.listConnections.mockImplementation(() => {
      callCount++;
      return Promise.resolve([]);
    });

    resetDiscoveryCache("user-no-cache");

    await getToolsForUser("user-no-cache");
    await getToolsForUser("user-no-cache");

    // listConnections appelé 2 fois = le cache vide n'a pas été stocké
    expect(callCount).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 7 : initiateConnection appelle invalidateUserDiscovery
//
// On importe le vrai module connections via vi.importActual pour tester la
// vraie logique, en s'assurant que notre mock invalidateUserDiscovery est appelé.
// ─────────────────────────────────────────────────────────────────────────────

describe("initiateConnection — invalidate discovery cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.isComposioConfigured.mockReturnValue(true);
  });

  it("connexion réussie → invalidateUserDiscovery appelé avec userId", async () => {
    m.getComposio.mockResolvedValue({
      toolkits: {
        authorize: vi.fn().mockResolvedValue({
          id: "conn-123",
          redirectUrl: "https://connect.composio.dev/oauth/callback",
        }),
      },
    });

    // Importer le vrai module connections (pas le mock global)
    const { initiateConnection } = await vi.importActual<
      typeof import("@/lib/connectors/composio/connections")
    >("@/lib/connectors/composio/connections");

    const result = await initiateConnection("user-42", "slack");

    expect(result.ok).toBe(true);
    // La vraie fonction appelle invalidateUserDiscovery via le module mocké
    expect(m.invalidateUserDiscovery).toHaveBeenCalledWith("user-42");
  });

  it("connexion échouée → invalidateUserDiscovery NON appelé", async () => {
    m.getComposio.mockResolvedValue({
      toolkits: {
        authorize: vi.fn().mockRejectedValue(new Error("toolkit_not_found")),
      },
    });

    const { initiateConnection } = await vi.importActual<
      typeof import("@/lib/connectors/composio/connections")
    >("@/lib/connectors/composio/connections");

    const result = await initiateConnection("user-99", "unknown_app");

    expect(result.ok).toBe(false);
    // En cas d'échec, le cache n'est pas invalidé
    expect(m.invalidateUserDiscovery).not.toHaveBeenCalled();
  });
});
