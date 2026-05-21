/**
 * Tests unitaires — cortex_search tool
 *
 * Mock cortex-client pour tester le comportement du tool en isolation :
 * résultats valides, liste vide, requête vide, erreur réseau.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildCortexSearchTools } from "../cortex-search";

// Mock du module cortex-client (toute la fonction searchCortexMemory)
vi.mock("@/lib/memory/cortex-client", () => ({
  searchCortexMemory: vi.fn(),
}));

// Import du mock APRÈS vi.mock pour avoir accès au spy
import { searchCortexMemory } from "@/lib/memory/cortex-client";

const mockSearchCortexMemory = vi.mocked(searchCortexMemory);

// Helper : RetrievedEmbedding minimal valide
function makeResult(
  overrides: Partial<{
    sourceId: string;
    title: string;
    textExcerpt: string;
    similarity: number;
  }> = {},
) {
  return {
    sourceKind: "transcript" as const,
    sourceId: overrides.sourceId ?? "02_Projets/Hearst.md",
    textExcerpt: overrides.textExcerpt ?? "Excerpt de la note",
    similarity: overrides.similarity ?? 0.87,
    metadata: {
      source: "cortex_ltm",
      title: overrides.title ?? "Hearst — Architecture",
      projet: "Hearst",
      cortexType: "projet",
    },
    createdAt: "2026-05-01T00:00:00Z",
  };
}

// Build le tool une seule fois (scope arbitraire — non utilisé pour l'instant)
function buildTool() {
  const tools = buildCortexSearchTools({
    scope: { userId: "u1", tenantId: "t1", workspaceId: "w1" },
  });
  return tools.cortex_search;
}

describe("cortex_search tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("(a) retourne les 2 titres + header 'trouvée(s) dans Cortex' quand 2 résultats", async () => {
    mockSearchCortexMemory.mockResolvedValue([
      makeResult({ title: "Note Alpha", sourceId: "vault/alpha.md" }),
      makeResult({ title: "Note Beta", sourceId: "vault/beta.md", similarity: 0.75 }),
    ]);

    const tool = buildTool();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const result = await tool.execute!({ query: "architecture Hearst" }, {} as never);

    expect(typeof result).toBe("string");
    const str = result as string;
    expect(str).toContain("trouvée(s) dans Cortex");
    expect(str).toContain("Note Alpha");
    expect(str).toContain("Note Beta");
    expect(str).toMatch(/\[0\.\d{3}\]/);
  });

  it("(b) retourne 'Aucune note pertinente' quand searchCortexMemory retourne []", async () => {
    mockSearchCortexMemory.mockResolvedValue([]);

    const tool = buildTool();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const result = await tool.execute!({ query: "sujet inconnu" }, {} as never);

    expect(typeof result).toBe("string");
    expect(result as string).toContain("Aucune note pertinente");
  });

  it("(c) retourne 'Erreur : requête vide.' et N'appelle PAS searchCortexMemory si query vide", async () => {
    const tool = buildTool();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const result = await tool.execute!({ query: "   " }, {} as never);

    expect(typeof result).toBe("string");
    expect(result as string).toBe("Erreur : requête vide.");
    expect(mockSearchCortexMemory).not.toHaveBeenCalled();
  });

  it("(d) retourne 'Erreur recherche Cortex : ...' sans throw et sans exposer l'URL si searchCortexMemory throw", async () => {
    const fakeError = new Error("https://cortex.hearst.app/api/search — 503 Service Unavailable");
    fakeError.name = "FetchError";
    mockSearchCortexMemory.mockRejectedValue(fakeError);

    const tool = buildTool();

    // Ne doit PAS propager l'erreur — appel direct, pas de wrapper expect
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const result: unknown = await tool.execute!({ query: "test" }, {} as never);

    expect(typeof result).toBe("string");
    const str = result as string;
    expect(str).toContain("Erreur recherche Cortex :");
    // Le nom de l'erreur (FetchError) est exposé, mais PAS err.message (qui contient l'URL)
    expect(str).toContain("FetchError");
    expect(str).not.toContain("https://");
    expect(str).not.toContain("cortex.hearst.app");
  });
});
