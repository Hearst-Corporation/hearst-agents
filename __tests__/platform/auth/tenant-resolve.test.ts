/**
 * Tenant resolution — frontière fédération Hive → Helm.
 * Vérifie que tout identifiant tenant entrant devient un UUID canonique pour la
 * DB, sans jamais propager un slug dans une colonne uuid, et que la convention
 * d'entity Composio (slug) reste distincte.
 */

import { describe, expect, it } from "vitest";
import {
  isUuid,
  resolveImpersonationTenant,
  type TenantSource,
} from "@/lib/platform/auth/tenant-resolve";

const SERVICE_TOKEN_TENANT = "d10c9c22-2432-4daa-b4f2-ab849a87dfae";
const SOME_UUID = "99999999-8888-7777-6666-555555555555";

describe("isUuid", () => {
  it("reconnaît un UUID v4/v5 canonique", () => {
    expect(isUuid(SERVICE_TOKEN_TENANT)).toBe(true);
    expect(isUuid(SOME_UUID)).toBe(true);
    expect(isUuid("  " + SOME_UUID + "  ")).toBe(true); // trim
  });

  it("rejette un slug humain", () => {
    expect(isUuid("adrien")).toBe(false);
    expect(isUuid("test2")).toBe(false);
    expect(isUuid("")).toBe(false);
    expect(isUuid("not-a-uuid")).toBe(false);
  });
});

describe("resolveImpersonationTenant", () => {
  it("slug 'adrien' sans map → fallback sur le tenant du service token (UUID canonique)", () => {
    const r = resolveImpersonationTenant("adrien", SERVICE_TOKEN_TENANT, {});
    expect(r.tenantUuid).toBe(SERVICE_TOKEN_TENANT);
    expect(r.source).toBe<TenantSource>("service-token-fallback");
    // Jamais le slug dans le champ tenant (anti `invalid input syntax for type uuid`).
    expect(isUuid(r.tenantUuid)).toBe(true);
    expect(r.tenantUuid).not.toBe("adrien");
  });

  it("slug présent dans la map d'alias → UUID mappé (canonique explicite)", () => {
    const map = { adrien: SOME_UUID };
    const r = resolveImpersonationTenant("adrien", SERVICE_TOKEN_TENANT, map);
    expect(r.tenantUuid).toBe(SOME_UUID);
    expect(r.source).toBe<TenantSource>("alias-map");
  });

  it("forwarded déjà UUID → passthrough (lowercased), pas de fallback", () => {
    const upper = SOME_UUID.toUpperCase();
    const r = resolveImpersonationTenant(upper, SERVICE_TOKEN_TENANT, {});
    expect(r.tenantUuid).toBe(SOME_UUID); // lowercased
    expect(r.source).toBe<TenantSource>("header-uuid");
  });

  it("map avec valeur non-UUID → ignorée, fallback service token", () => {
    const map = { adrien: "pas-un-uuid" };
    const r = resolveImpersonationTenant("adrien", SERVICE_TOKEN_TENANT, map);
    expect(r.tenantUuid).toBe(SERVICE_TOKEN_TENANT);
    expect(r.source).toBe<TenantSource>("service-token-fallback");
  });

  it("déterministe : même entrée → même sortie", () => {
    const a = resolveImpersonationTenant("test2", SERVICE_TOKEN_TENANT, {});
    const b = resolveImpersonationTenant("test2", SERVICE_TOKEN_TENANT, {});
    expect(a.tenantUuid).toBe(b.tenantUuid);
    expect(a.source).toBe(b.source);
  });

  it("trim des espaces sur l'entrée", () => {
    const r = resolveImpersonationTenant("  " + SOME_UUID + "  ", SERVICE_TOKEN_TENANT, {});
    expect(r.tenantUuid).toBe(SOME_UUID);
    expect(r.source).toBe<TenantSource>("header-uuid");
  });

  it("multi-tenant : deux slugs distincts via map → deux UUID distincts (isolation)", () => {
    const map = {
      adrien: "d10c9c22-2432-4daa-b4f2-ab849a87dfae",
      test2: "11111111-2222-3333-4444-555555555555",
    };
    const a = resolveImpersonationTenant("adrien", SERVICE_TOKEN_TENANT, map);
    const b = resolveImpersonationTenant("test2", SERVICE_TOKEN_TENANT, map);
    expect(a.tenantUuid).not.toBe(b.tenantUuid);
    expect(a.source).toBe<TenantSource>("alias-map");
    expect(b.source).toBe<TenantSource>("alias-map");
  });
});
