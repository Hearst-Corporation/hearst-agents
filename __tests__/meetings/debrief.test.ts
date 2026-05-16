/**
 * Tests pour generateMeetingDebrief — vérifie le system prompt + comportement
 * fail-soft sans API key. L'appel Anthropic réel n'est pas mocké ; on couvre
 * surtout les chemins de garde (transcript vide, pas de clé).
 */

import { describe, expect, it, vi } from "vitest";
import { DEBRIEF_SYSTEM_PROMPT, generateMeetingDebrief } from "@/lib/meetings/debrief";

vi.mock("@/lib/llm/router", () => ({
  getProvider: vi.fn(() => ({
    name: "kimi",
    chat: vi.fn().mockRejectedValue(new Error("KIMI_API_KEY is not set")),
    streamChat: vi.fn(),
  })),
  resetLlmProviderCache: vi.fn(),
}));

vi.mock("@/lib/llm/circuit-breaker", () => ({
  defaultCircuitBreaker: {
    isOpen: vi.fn(() => false),
    recordSuccess: vi.fn(),
    recordFailure: vi.fn(),
  },
}));

describe("DEBRIEF_SYSTEM_PROMPT", () => {
  it("contient les 4 sections canoniques", () => {
    expect(DEBRIEF_SYSTEM_PROMPT).toContain("## Contexte");
    expect(DEBRIEF_SYSTEM_PROMPT).toContain("## Décisions");
    expect(DEBRIEF_SYSTEM_PROMPT).toContain("## Actions");
    expect(DEBRIEF_SYSTEM_PROMPT).toContain("## Suivi");
  });

  it("interdit l'invention factuelle", () => {
    expect(DEBRIEF_SYSTEM_PROMPT).toContain("Reste factuel");
    expect(DEBRIEF_SYSTEM_PROMPT.toLowerCase()).toContain("inférence");
  });

  it("charge la charte éditoriale unifiée (signal du bloc partagé)", () => {
    // Le bloc charte contient « VOIX HEARST » et « zéro emoji » — signal qu'il
    // est bien injecté par composeEditorialPrompt en tête.
    expect(DEBRIEF_SYSTEM_PROMPT).toContain("VOIX HEARST");
    expect(DEBRIEF_SYSTEM_PROMPT.toLowerCase()).toContain("zéro emoji");
  });

  it("cap explicite à 350 mots", () => {
    expect(DEBRIEF_SYSTEM_PROMPT).toContain("350 mots");
  });
});

describe("generateMeetingDebrief (gardes)", () => {
  it("retourne null si transcript vide", async () => {
    const result = await generateMeetingDebrief({
      transcript: "",
      actionItems: [],
    });
    expect(result).toBeNull();
  });

  it("retourne null si transcript whitespace only", async () => {
    const result = await generateMeetingDebrief({
      transcript: "   \n\n   ",
      actionItems: [],
    });
    expect(result).toBeNull();
  });

  it("retourne null quand provider throw (kimi indisponible)", async () => {
    const result = await generateMeetingDebrief({
      transcript: "Adrien : Bonjour Marc, comment ça va ? Marc : Bien.",
      actionItems: [],
    });
    expect(result).toBeNull();
  });
});
