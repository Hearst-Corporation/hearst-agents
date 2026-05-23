/**
 * Tests unitaires — cortex-client.ts
 *
 * Couvre :
 *   (a) succès → 2 results correctement mappés en RetrievedEmbedding
 *   (b) CORTEX_PUBLIC_API_KEY absent → [] sans fetch
 *   (c) fetch rejette (erreur réseau) → []
 *   (d) HTTP 500 → []
 *   (e) filtre anti-boucle C3 allégé (ROADMAP #5) : seul source="helm" exclu,
 *       path-based exclude supprimé — artefacts swarm/action passent
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { searchCortexMemory } from "../cortex-client";

// Réponse Cortex simulée avec 3 résultats (dont un à filtrer)
const MOCK_RESPONSE = {
  query: "test query",
  count: 3,
  results: [
    {
      path: "02_Projets/01_Actifs/Hearst.md",
      title: "Hearst — architecture agentique",
      score: 0.87,
      projet: "hearst",
      date: "2026-05-15T10:00:00.000Z",
      type: "projet",
      source: "obsidian",
      content_preview: "Orchestrateur agentique d'outils externes.",
    },
    {
      path: "05_Apprentissage/Dev/RAG.md",
      title: "RAG — Retrieval Augmented Generation",
      score: 0.72,
      projet: null,
      date: "2026-04-10T08:30:00.000Z",
      type: "ressource",
      source: "obsidian",
      content_preview: "Technique qui injecte des chunks pertinents dans le prompt.",
    },
    // Ce résultat doit être filtré par la règle anti-boucle C3
    {
      path: "helm/memory/recent.md",
      title: "Recent Helm memory",
      score: 0.91,
      projet: "helm",
      date: "2026-05-20T00:00:00.000Z",
      type: "message",
      source: "helm",
      content_preview: "Contenu originaire de Helm — doit être exclu.",
    },
  ],
};

describe("searchCortexMemory", () => {
  beforeEach(() => {
    vi.stubEnv("CORTEX_URL", "https://cortex.hearst.app");
    vi.stubEnv("CORTEX_PUBLIC_API_KEY", "test-api-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  // (a) Succès : 2 résultats mappés correctement (le 3e filtré par C3)
  it("(a) retourne les results mappés en RetrievedEmbedding et exclut ceux de Helm", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => MOCK_RESPONSE,
      }),
    );

    const results = await searchCortexMemory({ query: "architecture agentique", k: 5 });

    // Le résultat avec path "helm/memory/recent.md" doit être filtré
    expect(results).toHaveLength(2);

    // Vérification du premier résultat
    const first = results[0];
    expect(first.sourceKind).toBe("transcript");
    expect(first.sourceId).toBe("02_Projets/01_Actifs/Hearst.md");
    expect(first.similarity).toBe(0.87);
    expect(first.metadata.source).toBe("cortex_ltm");
    expect(first.metadata.title).toBe("Hearst — architecture agentique");
    expect(first.metadata.projet).toBe("hearst");
    expect(first.metadata.cortexType).toBe("projet");
    expect(first.textExcerpt).toBe("Orchestrateur agentique d'outils externes.");
    expect(first.createdAt).toBe("2026-05-15T10:00:00.000Z");

    // Vérification du second résultat
    const second = results[1];
    expect(second.sourceKind).toBe("transcript");
    expect(second.similarity).toBe(0.72);
    expect(second.metadata.source).toBe("cortex_ltm");

    // fetch doit avoir été appelé avec les bons arguments
    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://cortex.hearst.app/api/search");
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe("test-api-key");
    const body = JSON.parse(init.body as string);
    expect(body.mode).toBe("hybrid");
    expect(body.limit).toBe(5);
  });

  // (b) CORTEX_PUBLIC_API_KEY absent → [] sans fetch
  it("(b) retourne [] si CORTEX_PUBLIC_API_KEY est absent", async () => {
    vi.stubEnv("CORTEX_PUBLIC_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const results = await searchCortexMemory({ query: "test" });

    expect(results).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // (c) fetch rejette (erreur réseau) → []
  it("(c) retourne [] si fetch rejette (erreur réseau)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

    const results = await searchCortexMemory({ query: "test réseau" });

    expect(results).toEqual([]);
  });

  // (d) HTTP 500 → []
  it("(d) retourne [] si la réponse HTTP est 500", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }),
    );

    const results = await searchCortexMemory({ query: "test 500" });

    expect(results).toEqual([]);
  });

  // (e) Anti-boucle C3 allégée (ROADMAP #5) : seul source="helm" (chat-turns)
  // est exclu. Les path-based guards sont supprimés — les artefacts swarm/action
  // (source "helm-swarm" / "helm-action") et les notes dont le PATH contient
  // "helm/" mais la SOURCE n'est pas "helm" sont maintenant RETRIEVABLE.
  it("(e) filtre uniquement source=helm ; les paths helm/* sans source=helm passent désormais", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          query: "test",
          count: 4,
          results: [
            // Source "helm" explicite (chat-turn) → exclu (seule règle active)
            {
              path: "03_Areas/some-note.md",
              title: "Note avec source helm",
              score: 0.91,
              source: "helm",
              content_preview: "Source helm explicite — à exclure.",
            },
            // Path "helm/foo.md" mais source "obsidian" → PASSE (path-guard supprimé)
            {
              path: "helm/foo.md",
              title: "Artefact helm path, source obsidian",
              score: 0.99,
              source: "obsidian",
              content_preview: "Contenu artefact helm legacy — désormais retrievable.",
            },
            // Artefact swarm — source "helm-swarm" → PASSE (seul source="helm" exclu)
            {
              path: "helm/swarm/2026-05-23-swarm.md",
              title: "Résultat swarm",
              score: 0.88,
              source: "helm-swarm",
              content_preview: "Résultat d'un swarm CrewAI.",
            },
            // Résultat Cortex normal
            {
              path: "04_Resources/notion.md",
              title: "Note Cortex valide",
              score: 0.65,
              source: "obsidian",
              content_preview: "Contenu Cortex valide.",
            },
          ],
        }),
      }),
    );

    const results = await searchCortexMemory({ query: "test anti-boucle" });

    // Seul source="helm" est exclu → 3 résultats passent
    expect(results).toHaveLength(3);
    const sourceIds = results.map((r) => r.sourceId);
    expect(sourceIds).toContain("helm/foo.md");
    expect(sourceIds).toContain("helm/swarm/2026-05-23-swarm.md");
    expect(sourceIds).toContain("04_Resources/notion.md");
    expect(sourceIds).not.toContain("03_Areas/some-note.md");
  });
});
