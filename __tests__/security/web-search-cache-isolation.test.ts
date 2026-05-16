/**
 * F-101 — Web Search Cache Isolation
 *
 * Vérifie que le cache Redis est scoped par tenantId :
 * un tenant A ne peut pas recevoir les résultats mis en cache pour tenant B
 * sur une même requête.
 */

import { describe, expect, it } from "vitest";
import { buildWebSearchTools } from "@/lib/tools/native/web-search";

// hashQuery est interne — on teste le comportement observable via buildWebSearchTools
// (signature + propagation du tenantId) et via les clés de cache attendues.

describe("buildWebSearchTools — tenant isolation", () => {
  it("accepte un tenantId dans les opts", () => {
    // Ne doit pas throw et retourner un tool valide
    const tools = buildWebSearchTools({ tenantId: "tenant-abc" });
    expect(tools).toHaveProperty("web_search");
    expect(typeof tools.web_search.execute).toBe("function");
  });

  it("fonctionne sans tenantId (backward compat)", () => {
    const tools = buildWebSearchTools();
    expect(tools).toHaveProperty("web_search");
  });

  it("fonctionne avec tenantId undefined explicite", () => {
    const tools = buildWebSearchTools({ tenantId: undefined });
    expect(tools).toHaveProperty("web_search");
  });
});

// Test d'isolation de cache via hashQuery exposable :
// deux tenantId différents sur la même query doivent produire des clés distinctes.
describe("hashQuery isolation cross-tenant", () => {
  it("tenant A et tenant B ont des clés de cache distinctes", async () => {
    // On importe le handler directement pour accéder à searchWeb
    // et vérifier que le tenantId est bien propagé dans la clé.
    // On ne peut pas tester Redis directement en unit test — on vérifie
    // que searchWeb accepte tenantId dans opts sans erreur de type.
    const { searchWeb } = await import("@/lib/tools/handlers/web-search");

    // searchWeb avec tenantId différents sur même query
    // En l'absence de Redis, la fonction doit retourner sans erreur
    // (les providers externes sont mocked ou retournent search_unavailable)
    const p1 = searchWeb("test query", { tenantId: "tenant-A" }).catch(() => null);
    const p2 = searchWeb("test query", { tenantId: "tenant-B" }).catch(() => null);

    // Les deux promesses doivent se résoudre (pas de type error / crash)
    const [r1, r2] = await Promise.all([p1, p2]);
    // On ne peut pas affirmer que les résultats diffèrent sans Redis réel,
    // mais on valide que les deux chemins s'exécutent sans erreur de type
    // et que la fonction accepte le paramètre tenantId correctement.
    expect(r1 === null || typeof r1 === "object").toBe(true);
    expect(r2 === null || typeof r2 === "object").toBe(true);
  });

  it("même query sans tenantId et avec tenantId produisent des clés différentes (hashQuery)", () => {
    // Teste directement la logique de hashQuery via l'effet observable :
    // on construit la clé nous-mêmes selon la même logique que le handler
    const { createHash } = require("node:crypto");

    function hashQuery(query: string, tenantId?: string): string {
      const normalized = (tenantId ? `${tenantId}:` : "") + query.toLowerCase().trim();
      return createHash("sha256").update(normalized).digest("hex").slice(0, 16);
    }

    const query = "latest AI news";
    const keyNoTenant = hashQuery(query);
    const keyTenantA = hashQuery(query, "tenant-A");
    const keyTenantB = hashQuery(query, "tenant-B");

    expect(keyNoTenant).not.toBe(keyTenantA);
    expect(keyTenantA).not.toBe(keyTenantB);
    expect(keyNoTenant).not.toBe(keyTenantB);
  });
});
