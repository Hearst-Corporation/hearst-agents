/**
 * Anti-fabrication — vérifie que `buildAgentSystemPrompt` injecte la règle
 * anti-fabrication (interdiction d'inventer une panne d'infra / un résultat)
 * et que les blocs mémoire historique sont marqués comme NON-état-système.
 *
 * Garde anti-suppression accidentelle : si quelqu'un retire la règle du
 * prompt, ce test casse.
 */

import { describe, expect, it } from "vitest";
import { buildAgentSystemPrompt } from "@/lib/engine/orchestrator/system-prompt";

describe("buildAgentSystemPrompt — règle anti-fabrication", () => {
  it("contient la règle anti-fabrication", () => {
    const prompt = buildAgentSystemPrompt({ composioTools: [] });
    expect(prompt).toContain("RÈGLE ANTI-FABRICATION");
    expect(prompt).toContain("base de données indisponible");
    expect(prompt).toContain("agent desktop");
    expect(prompt.toLowerCase()).toContain("jamais de fausse cause");
  });

  it("marque <user_briefing> comme MÉMOIRE HISTORIQUE (pas l'état système)", () => {
    const prompt = buildAgentSystemPrompt({
      composioTools: [],
      briefing: "L'utilisateur travaille sur le projet Hive.",
    });
    expect(prompt).toContain("<user_briefing");
    // Le marqueur historique est porté par l'attribut note= du tag d'ouverture.
    const briefingTag = prompt.slice(
      prompt.indexOf("<user_briefing"),
      prompt.indexOf(">", prompt.indexOf("<user_briefing")) + 1,
    );
    expect(briefingTag).toContain("MÉMOIRE HISTORIQUE");
  });

  it("marque <retrieved_memory> comme MÉMOIRE HISTORIQUE (pas l'état système)", () => {
    const prompt = buildAgentSystemPrompt({
      composioTools: [],
      retrievedMemory: "Note passée : la base était down hier.",
    });
    expect(prompt).toContain("<retrieved_memory");
    const memTag = prompt.slice(
      prompt.indexOf("<retrieved_memory"),
      prompt.indexOf(">", prompt.indexOf("<retrieved_memory")) + 1,
    );
    expect(memTag).toContain("MÉMOIRE HISTORIQUE");
  });
});
