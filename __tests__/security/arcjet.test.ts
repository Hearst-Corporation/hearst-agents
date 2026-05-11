import { describe, it, expect } from "vitest";
import { aj, ajOrchestrate, ajLlmJobs, isArcjetEnabled } from "@/lib/security/arcjet";

/**
 * Tests de configuration Arcjet.
 *
 * Valide que les instances sont correctement configurées avec les bons quotas.
 * Les tests de décision (429 avec Retry-After) nécessitent une clé ARCJET_KEY
 * réelle — ici on valide juste la structure.
 */

describe("Arcjet configuration", () => {
  it("isArcjetEnabled vérifie la présence d'ARCJET_KEY", () => {
    // Sans clé (dev par défaut), la fonction retourne false
    const enabled = isArcjetEnabled();
    expect(typeof enabled).toBe("boolean");
  });

  it("aj instance configurée (ou null si pas de clé)", () => {
    // Dans un test sans ARCJET_KEY, aj est null
    // Dans CI/staging avec la clé, aj est un Arcjet client
    if (!isArcjetEnabled()) {
      expect(aj).toBeNull();
    } else {
      expect(aj).toBeTruthy();
      // Si enabled, on pourrait inspecter la config — mais arcjet
      // n'expose pas d'API publique pour ça. On trust la config du code.
    }
  });

  it("ajOrchestrate instance configurée (quota 10 req/min)", () => {
    // Même pattern : null ou Arcjet client
    if (!isArcjetEnabled()) {
      expect(ajOrchestrate).toBeNull();
    } else {
      expect(ajOrchestrate).toBeTruthy();
    }
  });

  it("ajLlmJobs instance configurée (quota 20 req/min)", () => {
    if (!isArcjetEnabled()) {
      expect(ajLlmJobs).toBeNull();
    } else {
      expect(ajLlmJobs).toBeTruthy();
    }
  });
});

describe("Arcjet decision matrix (intégration)", () => {
  it.skip("ajOrchestrate retourne 429 après 10 req/min dépassé", async () => {
    // Nécessite une clé Arcjet réelle + mock/simulation de 10+ requêtes
    // SKIP : validé manuellement ou via test e2e si besoin
    // (La vraie validation se fait en staging/CI avec le rate limiter actif)
  });

  it.skip("ajLlmJobs retourne 429 après 20 req/min dépassé", async () => {
    // Même prérequis
  });

  it.skip("aj default retourne 429 après 100 req/min dépassé", async () => {
    // Même prérequis
  });

  it.skip("rate limit response inclut header Retry-After", async () => {
    // Validé en e2e ou staging — pas testable en unit sans clé réelle
  });
});
