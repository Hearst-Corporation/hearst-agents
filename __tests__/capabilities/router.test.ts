/**
 * Capability Router Tests
 */

import { describe, expect, it } from "vitest";
import {
  isBusinessSurface,
  resolveCapabilityScope,
  resolveExecutionMode,
  scopeRequiresProviders,
  validateAgentForScope,
} from "@/lib/capabilities/router";

describe("resolveCapabilityScope", () => {
  it("email prompt → communication domain with gmail data", () => {
    const s = resolveCapabilityScope("Montre-moi mes emails récents");
    expect(s.domain).toBe("communication");
    expect(s.retrievalMode).toBe("messages");
    expect(s.toolContext).toBe("inbox");
    expect(s.needsProviderData.gmail).toBe(true);
    expect(s.providers).toContain("google");
  });

  it("calendar prompt → productivity domain with calendar data", () => {
    const s = resolveCapabilityScope("Quels sont mes rendez-vous demain ?");
    expect(s.domain).toBe("productivity");
    expect(s.retrievalMode).toBe("structured_data");
    expect(s.needsProviderData.calendar).toBe(true);
  });

  it("drive prompt → productivity domain with drive data", () => {
    const s = resolveCapabilityScope("Cherche dans mes fichiers Drive");
    expect(s.domain).toBe("productivity");
    expect(s.needsProviderData.drive).toBe(true);
    expect(s.retrievalMode).toBe("documents");
  });

  it("finance prompt → finance domain, stripe provider", () => {
    const s = resolveCapabilityScope("Analyse du marché crypto");
    expect(s.domain).toBe("finance");
    expect(s.providers).toContain("stripe");
  });

  it("generic prompt → general domain, no providers needed", () => {
    const s = resolveCapabilityScope("Bonjour comment ça va");
    expect(s.domain).toBe("general");
    expect(s.retrievalMode).toBeNull();
    expect(s.needsProviderData.calendar).toBe(false);
    expect(s.needsProviderData.gmail).toBe(false);
  });

  it("surface override takes priority", () => {
    const s = resolveCapabilityScope("Bonjour", "inbox");
    expect(s.domain).toBe("communication");
    expect(s.toolContext).toBe("inbox");
  });

  it("surface home → no override", () => {
    const s = resolveCapabilityScope("Bonjour", "home");
    expect(s.domain).toBe("general");
  });

  // ── Fix 1a — surface conteneur "hive" ne court-circuite PAS le routing ──
  it('container surface "hive" → keyword routing (NOT forced general)', () => {
    const s = resolveCapabilityScope("Est-ce que t'as mes emails", "hive");
    expect(s.domain).toBe("communication");
    expect(s.domain).not.toBe("general");
    expect(s.needsProviderData.gmail).toBe(true);
  });

  it('container surface "hive" with email prompt → execution mode is NOT direct_answer', () => {
    const s = resolveCapabilityScope("Est-ce que t'as mes emails", "hive");
    const decision = resolveExecutionMode(s, "Est-ce que t'as mes emails");
    expect(decision.mode).not.toBe("direct_answer");
  });

  it('container surface "hive" with smalltalk → still general (no false provider)', () => {
    const s = resolveCapabilityScope("Bonjour comment ça va", "hive");
    expect(s.domain).toBe("general");
    expect(s.needsProviderData.gmail).toBe(false);
  });

  it("unknown surface falls back to keyword routing", () => {
    const s = resolveCapabilityScope("Quels sont mes rendez-vous demain ?", "some-unknown-surface");
    expect(s.domain).toBe("productivity");
  });
});

describe("isBusinessSurface", () => {
  it("recognizes the 5 business surfaces", () => {
    for (const surface of ["inbox", "calendar", "files", "finance", "research"]) {
      expect(isBusinessSurface(surface)).toBe(true);
    }
  });

  it("rejects container/unknown surfaces", () => {
    for (const surface of ["hive", "home", "unknown", undefined, ""]) {
      expect(isBusinessSurface(surface)).toBe(false);
    }
  });
});

describe("validateAgentForScope", () => {
  it("FinanceAgent valid for finance scope", () => {
    const scope = resolveCapabilityScope("Analyse stripe paiements");
    const r = validateAgentForScope("FinanceAgent", scope);
    expect(r.valid).toBe(true);
  });

  it("FinanceAgent invalid for communication scope", () => {
    const scope = resolveCapabilityScope("Montre-moi mes emails");
    const r = validateAgentForScope("FinanceAgent", scope);
    expect(r.valid).toBe(false);
    expect(r.reason).toContain("not valid for domain");
  });

  it("DocBuilder (general agent) valid everywhere", () => {
    const scope = resolveCapabilityScope("Montre-moi mes emails");
    const r = validateAgentForScope("DocBuilder", scope);
    expect(r.valid).toBe(true);
  });
});

describe("scopeRequiresProviders", () => {
  it("communication requires providers", () => {
    const scope = resolveCapabilityScope("Montre-moi mes emails");
    expect(scopeRequiresProviders(scope)).toBe(true);
  });

  it("research does NOT require providers (uses web)", () => {
    const scope = resolveCapabilityScope("Fais une recherche sur les tendances du marché");
    expect(scopeRequiresProviders(scope)).toBe(false);
  });

  it("hybrid prompt (research + finance keyword) resolves to finance", () => {
    const scope = resolveCapabilityScope("Fais une recherche sur Bitcoin");
    expect(scope.domain).toBe("finance");
    expect(scopeRequiresProviders(scope)).toBe(true);
  });

  it("general does NOT require providers", () => {
    const scope = resolveCapabilityScope("Bonjour");
    expect(scopeRequiresProviders(scope)).toBe(false);
  });
});
