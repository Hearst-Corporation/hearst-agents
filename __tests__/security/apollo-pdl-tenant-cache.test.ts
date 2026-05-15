/**
 * P0-6 — LRU cache cross-tenant fix.
 *
 * Vérifie que les caches Apollo + PDL sont scopés par tenantId :
 * - Tenant A enrichit un contact → ne fuit pas vers tenant B
 * - Tenant A et B partagent le même worker Node → cache distinct
 * - Sans tenantId (chemin legacy), la sentinelle "tenant:none" isole
 */

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

beforeAll(() => {
  process.env.APOLLO_API_KEY = "test-apollo-key";
  process.env.PDL_API_KEY = "test-pdl-key";
});

// Mock fetch — chaque appel retourne un payload distinct identifiable
// pour vérifier que le cache ne sert PAS la mauvaise réponse.
const fetchMock = vi.fn();
beforeAll(() => {
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  fetchMock.mockReset();
});

describe("P0-6 Apollo cache tenant-scoping", () => {
  it("retourne des données distinctes pour deux tenants même email", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          person: { name: "Alice TenantA", title: "CEO" },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          person: { name: "Alice TenantB", title: "VP" },
        }),
      });

    const { enrichPerson, _resetApolloCache } = await import("@/lib/capabilities/providers/apollo");
    _resetApolloCache();

    const a = await enrichPerson({ email: "alice@example.com", tenantId: "tenant-a" });
    const b = await enrichPerson({ email: "alice@example.com", tenantId: "tenant-b" });

    expect(a.name).toBe("Alice TenantA");
    expect(b.name).toBe("Alice TenantB");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("hit le cache pour le MÊME tenant sur appels répétés", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ person: { name: "Bob" } }),
    });

    const { enrichPerson, _resetApolloCache } = await import("@/lib/capabilities/providers/apollo");
    _resetApolloCache();

    const r1 = await enrichPerson({ email: "bob@example.com", tenantId: "tenant-a" });
    const r2 = await enrichPerson({ email: "bob@example.com", tenantId: "tenant-a" });

    expect(r1.name).toBe("Bob");
    expect(r2.name).toBe("Bob");
    expect(fetchMock).toHaveBeenCalledTimes(1); // 2e call sert le cache
  });

  it("isole les tenants même si l'un n'a pas de tenantId (legacy)", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ person: { name: "Charlie Legacy" } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ person: { name: "Charlie Real" } }),
      });

    const { enrichPerson, _resetApolloCache } = await import("@/lib/capabilities/providers/apollo");
    _resetApolloCache();

    // 1er call sans tenantId — sentinelle "tenant:none"
    const legacy = await enrichPerson({ email: "charlie@example.com" });
    // 2e call avec tenant réel — clé distincte
    const real = await enrichPerson({ email: "charlie@example.com", tenantId: "tenant-real" });

    expect(legacy.name).toBe("Charlie Legacy");
    expect(real.name).toBe("Charlie Real");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("P0-6 PDL cache tenant-scoping", () => {
  it("retourne des données distinctes pour deux tenants même domain", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ name: "Acme TenantA", industry: "SaaS" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ name: "Acme TenantB", industry: "Fintech" }),
      });

    const { enrichCompany, _resetPdlCache } = await import("@/lib/capabilities/providers/pdl");
    _resetPdlCache();

    const a = await enrichCompany({ domain: "acme.com", tenantId: "tenant-a" });
    const b = await enrichCompany({ domain: "acme.com", tenantId: "tenant-b" });

    expect(a.name).toBe("Acme TenantA");
    expect(b.name).toBe("Acme TenantB");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("hit le cache pour le même tenant", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ name: "Stripe" }),
    });

    const { enrichCompany, _resetPdlCache } = await import("@/lib/capabilities/providers/pdl");
    _resetPdlCache();

    const r1 = await enrichCompany({ domain: "stripe.com", tenantId: "tenant-a" });
    const r2 = await enrichCompany({ domain: "stripe.com", tenantId: "tenant-a" });

    expect(r1.name).toBe("Stripe");
    expect(r2.name).toBe("Stripe");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
