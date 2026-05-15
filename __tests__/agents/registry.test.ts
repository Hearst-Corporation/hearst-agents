import { describe, expect, it } from "vitest";
import { getAgentById, getAgentsByContext } from "@/lib/agents/registry";

/**
 * Tests du registry d'agents.
 *
 * Valide que les agents sont correctement enregistrés et retrouvables
 * par id ou contexte.
 */

describe("Agent Registry", () => {
  it("getAgentById retourne un agent enregistré", () => {
    // inbox_agent est enregistré à la compilation du module
    const agent = getAgentById("inbox_agent");
    expect(agent).toBeDefined();
    expect(agent?.id).toBe("inbox_agent");
    expect(agent?.name).toBe("Inbox Agent");
  });

  it("getAgentById retourne undefined pour un agent inexistant", () => {
    const agent = getAgentById("nonexistent-agent");
    expect(agent).toBeUndefined();
  });

  it("getAgentsByContext retourne les agents d'un contexte donné", () => {
    // Cherche tous les agents avec defaultContext="inbox"
    const agents = getAgentsByContext("inbox");
    expect(Array.isArray(agents)).toBe(true);
    // inbox_agent a inbox comme defaultContext
    const foundInbox = agents.find((a) => a.id === "inbox_agent");
    expect(foundInbox).toBeDefined();
  });

  it("getAgentsByContext retourne array vide pour contexte absent", () => {
    const agents = getAgentsByContext("nonexistent-context");
    expect(Array.isArray(agents)).toBe(true);
    expect(agents.length).toBe(0);
  });

  it("agent enregistré a tous les champs requis", () => {
    const agent = getAgentById("calendar_agent");
    expect(agent).toBeDefined();
    expect(agent?.id).toBeDefined();
    expect(agent?.name).toBeDefined();
    expect(agent?.description).toBeDefined();
    expect(Array.isArray(agent?.capabilities)).toBe(true);
    expect(Array.isArray(agent?.allowedTools)).toBe(true);
    expect(typeof agent?.defaultContext).toBe("string");
  });
});
