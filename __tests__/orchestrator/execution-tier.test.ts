import { describe, expect, it } from "vitest";
import {
  classifyExecutionTier,
  gateToolsByTier,
  hasActionVerb,
  isExplicitSwarmRequest,
  isRecallIntent,
} from "@/lib/engine/orchestrator/execution-tier";

describe("classifyExecutionTier", () => {
  it("action — verbe machine explicite", () => {
    expect(classifyExecutionTier("ouvre le site apple.com et clique sur Acheter").tier).toBe(
      "action",
    );
    expect(classifyExecutionTier("remplis le formulaire de contact").tier).toBe("action");
  });

  it("action — URL explicite", () => {
    expect(classifyExecutionTier("résume https://techcrunch.com pour moi").tier).toBe("action");
  });

  it("swarm — demande explicite courte (pas de seuil de longueur)", () => {
    expect(classifyExecutionTier("lance une revue de projet").tier).toBe("swarm");
    expect(classifyExecutionTier("fais un audit complet de la sécurité").tier).toBe("swarm");
    expect(classifyExecutionTier("deep research sur le marché").tier).toBe("swarm");
  });

  it("memory — recall pur de mémoire", () => {
    expect(classifyExecutionTier("qu'est-ce que j'avais noté sur le projet Helm").tier).toBe(
      "memory",
    );
    expect(classifyExecutionTier("what did i decide about pricing").tier).toBe("memory");
  });

  it("direct — requête simple ou vide", () => {
    expect(classifyExecutionTier("quelle heure est-il ?").tier).toBe("direct");
    expect(classifyExecutionTier("merci !").tier).toBe("direct");
    expect(classifyExecutionTier("").tier).toBe("direct");
  });

  it("priorité action > swarm (un verbe machine prime sur 'audit')", () => {
    expect(classifyExecutionTier("ouvre le site et fais un audit complet").tier).toBe("action");
  });
});

describe("détecteurs unitaires", () => {
  it("hasActionVerb", () => {
    expect(hasActionVerb("navigue vers la page produit")).toBe(true);
    expect(hasActionVerb("explique-moi le concept")).toBe(false);
  });
  it("isExplicitSwarmRequest", () => {
    expect(isExplicitSwarmRequest("fais une analyse approfondie")).toBe(true);
    expect(isExplicitSwarmRequest("bonjour")).toBe(false);
  });
  it("isRecallIntent", () => {
    expect(isRecallIntent("retrouve ma note sur le budget")).toBe(true);
    expect(isRecallIntent("génère un budget")).toBe(false);
  });
});

describe("gateToolsByTier — anti-sur-déclenchement swarm", () => {
  const tools = ["cortex_search", "kickoff_swarm", "search_web"];

  it("retire kickoff_swarm hors tier swarm", () => {
    expect(gateToolsByTier(tools, "direct")).not.toContain("kickoff_swarm");
    expect(gateToolsByTier(tools, "memory")).not.toContain("kickoff_swarm");
    expect(gateToolsByTier(tools, "action")).not.toContain("kickoff_swarm");
  });

  it("conserve cortex_search (non gaté) dans tous les tiers", () => {
    expect(gateToolsByTier(tools, "direct")).toContain("cortex_search");
    expect(gateToolsByTier(tools, "direct")).toContain("search_web");
  });

  it("conserve kickoff_swarm en tier swarm", () => {
    expect(gateToolsByTier(tools, "swarm")).toEqual(tools);
  });

  it("fail-soft sur entrée vide", () => {
    expect(gateToolsByTier([], "direct")).toEqual([]);
  });
});
