/**
 * Domain Routing Contract Tests
 *
 * Captures the current keyword-based domain routing behavior across
 * the dispersed heuristics: resolveRetrievalMode, getRequiredProvidersForInput,
 * isResearchIntent / isReportIntent.
 *
 * These snapshots protect against regressions when we consolidate
 * all keyword logic into a single capability taxonomy.
 */

import { describe, expect, it } from "vitest";
import { resolveRetrievalMode } from "@/lib/capabilities/taxonomy";
import { getRequiredProvidersForInput } from "@/lib/engine/orchestrator/provider-requirements";
import {
  isActionOrPlanIntent,
  isReportIntent,
  isResearchIntent,
  shouldBypassResearchPath,
} from "@/lib/engine/orchestrator/research-intent";

// ── resolveRetrievalMode (replaces detectRetrievalMode) ─────

describe("resolveRetrievalMode — contract", () => {
  const cases: Array<{ input: string; expected: string | null }> = [
    { input: "Montre-moi mes emails récents", expected: "messages" },
    { input: "Show me my inbox", expected: "messages" },
    { input: "Quels sont mes fichiers Drive ?", expected: "documents" },
    { input: "Find my documents", expected: "documents" },
    { input: "Quels sont mes rendez-vous aujourd'hui ?", expected: "structured_data" },
    { input: "What meetings do I have?", expected: "structured_data" },
    { input: "Bonjour, comment ça va ?", expected: null },
    { input: "Fais une recherche sur Bitcoin", expected: null },
  ];

  for (const { input, expected } of cases) {
    it(`"${input.slice(0, 50)}" → ${expected}`, () => {
      expect(resolveRetrievalMode(input)).toBe(expected);
    });
  }
});

// ── getRequiredProvidersForInput ─────────────────────────────

describe("getRequiredProvidersForInput — contract", () => {
  it("email prompt → requires google provider", () => {
    const r = getRequiredProvidersForInput("Montre-moi mes emails");
    expect(r).not.toBeNull();
    expect(r?.providers).toContain("google");
  });

  it("calendar prompt → requires google provider", () => {
    const r = getRequiredProvidersForInput("Mon agenda pour demain");
    expect(r).not.toBeNull();
    expect(r?.providers).toContain("google");
  });

  it("generic prompt → no provider required", () => {
    const r = getRequiredProvidersForInput("Bonjour");
    expect(r).toBeNull();
  });
});

// ── research-intent ─────────────────────────────────────────

describe("isResearchIntent — contract", () => {
  it("detects research keywords", () => {
    expect(isResearchIntent("Fais une recherche sur Bitcoin")).toBe(true);
    expect(isResearchIntent("Analyse du marché crypto")).toBe(true);
    expect(isResearchIntent("Compare les tendances")).toBe(true);
  });

  it("does not detect non-research", () => {
    expect(isResearchIntent("Bonjour")).toBe(false);
    expect(isResearchIntent("Montre-moi mes emails")).toBe(false);
  });
});

describe("isReportIntent — contract", () => {
  it("detects report keywords", () => {
    expect(isReportIntent("Fais-moi un rapport sur Bitcoin")).toBe(true);
    expect(isReportIntent("Rédige une synthèse")).toBe(true);
    expect(isReportIntent("Generate a summary")).toBe(true);
  });

  it("does not detect non-report", () => {
    expect(isReportIntent("Bonjour")).toBe(false);
  });
});

// ── isActionOrPlanIntent — les 6 cas de la spec ───────────────

describe("isActionOrPlanIntent — action/plan detection", () => {
  // Les 3 cas qui DOIVENT rester research (false)
  it("'Fais-moi un rapport sur le marché crypto' → NOT action (reste research)", () => {
    expect(isActionOrPlanIntent("Fais-moi un rapport sur le marché crypto")).toBe(false);
  });

  it("'Résume-moi les dernières actus IA' → NOT action (reste research)", () => {
    expect(isActionOrPlanIntent("Résume-moi les dernières actus IA")).toBe(false);
  });

  it("'Analyse la concurrence' → NOT action (reste research)", () => {
    expect(isActionOrPlanIntent("Analyse la concurrence")).toBe(false);
  });

  // Les 3 cas qui DOIVENT bypasser (true)
  it("'Envoie un email à test@example.com avec le résumé de la semaine' → IS action (bypass)", () => {
    expect(
      isActionOrPlanIntent("Envoie un email à test@example.com avec le résumé de la semaine"),
    ).toBe(true);
  });

  it("'Crée un plan en plusieurs étapes : rédige le rapport puis publie sur Slack, demande mon approbation avant publication' → IS plan (bypass)", () => {
    expect(
      isActionOrPlanIntent(
        "Crée un plan en plusieurs étapes : rédige le rapport puis publie sur Slack, demande mon approbation avant publication",
      ),
    ).toBe(true);
  });

  it("'Publie un post sur Slack #general' → IS action (bypass)", () => {
    expect(isActionOrPlanIntent("Publie un post sur Slack #general")).toBe(true);
  });
});

// ── shouldBypassResearchPath — les 6 cas identiques via le point d'entrée public ──

describe("shouldBypassResearchPath — action intent integration", () => {
  // Les 3 cas research — shouldBypassResearchPath doit retourner false (pas de bypass)
  it("'Fais-moi un rapport sur le marché crypto' → does NOT bypass (research path)", () => {
    expect(shouldBypassResearchPath("Fais-moi un rapport sur le marché crypto")).toBe(false);
  });

  it("'Résume-moi les dernières actus IA' → does NOT bypass (research path)", () => {
    expect(shouldBypassResearchPath("Résume-moi les dernières actus IA")).toBe(false);
  });

  it("'Analyse la concurrence' → does NOT bypass (research path)", () => {
    expect(shouldBypassResearchPath("Analyse la concurrence")).toBe(false);
  });

  // Les 3 cas action — shouldBypassResearchPath doit retourner true (bypass)
  it("'Envoie un email à test@example.com avec le résumé de la semaine' → BYPASS (action)", () => {
    expect(
      shouldBypassResearchPath("Envoie un email à test@example.com avec le résumé de la semaine"),
    ).toBe(true);
  });

  it("'Crée un plan en plusieurs étapes : rédige le rapport puis publie sur Slack, demande mon approbation avant publication' → BYPASS (plan)", () => {
    expect(
      shouldBypassResearchPath(
        "Crée un plan en plusieurs étapes : rédige le rapport puis publie sur Slack, demande mon approbation avant publication",
      ),
    ).toBe(true);
  });

  it("'Publie un post sur Slack #general' → BYPASS (action)", () => {
    expect(shouldBypassResearchPath("Publie un post sur Slack #general")).toBe(true);
  });
});
