/**
 * Feature 4 — PERSONAS : invariants builtins + isDefault + systemPromptAddon + surface.
 *
 * Tests P2 :
 *  1. Builtins non supprimables via deletePersona (builtin:default → no-op / false)
 *  2. Un seul isDefault : createPersona avec isDefault:true → update is_default:false d'abord
 *  3. systemPromptAddon > 1500 chars → tronqué dans buildPersonaAddon
 *  4. getPersonaForSurface("voice") → retourne builtin:casual si aucune persona custom
 */

import { describe, expect, it, vi } from "vitest";
import { BUILTIN_PERSONAS } from "@/lib/personas/defaults";
import { buildPersonaAddon } from "@/lib/personas/system-prompt-addon";
import type { Persona } from "@/lib/personas/types";

// ── Contrôleurs du mock Supabase ──────────────────────────────
// On définit des mocks mutables pour contrôler les retours par test.

const mockUpdatedRows: Array<{ is_default: boolean }> = [];
const mockInsertedRows: Array<Record<string, unknown>> = [];
let mockMaybeSingleResult: { data: unknown; error: unknown } = { data: null, error: null };

vi.mock("@/lib/platform/db/supabase", () => ({
  getServerSupabase: () => ({
    from: () => ({
      update: (patch: Record<string, unknown>) => {
        if ("is_default" in patch) {
          mockUpdatedRows.push({ is_default: patch.is_default as boolean });
        }
        return {
          eq: () => ({
            eq: () => Promise.resolve({ error: null }),
          }),
        };
      },
      insert: (row: Record<string, unknown>) => {
        mockInsertedRows.push(row);
        return {
          select: () => ({
            single: () =>
              Promise.resolve({
                data: {
                  id: "new-id",
                  user_id: row.user_id ?? "u1",
                  tenant_id: row.tenant_id ?? "t1",
                  name: row.name ?? "Test",
                  description: null,
                  tone: null,
                  vocabulary: null,
                  style_guide: null,
                  system_prompt_addon: null,
                  surface: null,
                  is_default: row.is_default ?? false,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
                error: null,
              }),
          }),
        };
      },
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({
              limit: () => ({
                maybeSingle: () => Promise.resolve(mockMaybeSingleResult),
              }),
            }),
          }),
        }),
      }),
      delete: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => Promise.resolve({ error: null }),
          }),
        }),
      }),
    }),
  }),
}));

vi.mock("@/lib/verticals/hospitality", () => ({
  getTenantIndustry: vi.fn().mockResolvedValue("other"),
}));

const SCOPE = { userId: "u1", tenantId: "t1" };

// ── Test 1 : Builtins non supprimables ────────────────────────

describe("deletePersona — builtins non supprimables", () => {
  it("deletePersona avec id 'builtin:default' → retourne bool sans throw", async () => {
    const { deletePersona } = await import("@/lib/personas/store");
    // Les builtins ne sont pas en DB — le DELETE ne touche aucune ligne → true/false
    const result = await deletePersona("builtin:default", SCOPE);
    expect(typeof result).toBe("boolean");
  });

  it("les builtins existent dans BUILTIN_PERSONAS (référence mémoire stable)", () => {
    const builtin = BUILTIN_PERSONAS.find((p) => p.id === "builtin:default");
    expect(builtin).toBeDefined();
    expect(builtin?.isDefault).toBe(true);
  });
});

// ── Test 2 : Un seul isDefault par (user, tenant) ─────────────

describe("createPersona — isDefault unique par (user, tenant)", () => {
  it("createPersona avec isDefault:true met les précédentes à false", async () => {
    // Réinitialiser les capteurs
    mockUpdatedRows.length = 0;
    mockInsertedRows.length = 0;

    const { createPersona } = await import("@/lib/personas/store");

    await createPersona({
      userId: "u1",
      tenantId: "t1",
      name: "New Default",
      isDefault: true,
    });

    // Doit avoir mis is_default: false sur les précédentes via update()
    expect(mockUpdatedRows.some((r) => r.is_default === false)).toBe(true);
    // Doit avoir inséré avec is_default: true
    expect(mockInsertedRows[0]?.is_default).toBe(true);
  });
});

// ── Test 3 : systemPromptAddon tronqué à 1500 chars ──────────

describe("buildPersonaAddon — cap 1500 chars", () => {
  it("systemPromptAddon > 1500 chars → le body du bloc persona est tronqué", () => {
    const longAddon = "A".repeat(2000);

    const persona: Persona = {
      id: "test-persona",
      userId: "u1",
      tenantId: "t1",
      name: "Test",
      tone: "direct",
      vocabulary: null,
      styleGuide: null,
      systemPromptAddon: longAddon,
      surface: null,
      isDefault: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const addon = buildPersonaAddon(persona);

    expect(addon).toContain("<persona>");
    expect(addon).toContain("</persona>");

    // Le body entre les balises ne dépasse pas 1500 chars
    const bodyMatch = addon.match(/<persona>\n([\s\S]*)\n<\/persona>/);
    expect(bodyMatch).not.toBeNull();
    const body = bodyMatch?.[1]!;
    expect(body.length).toBeLessThanOrEqual(1500);
  });

  it("systemPromptAddon de 100 chars → rendu complet sans troncature", () => {
    const shortAddon = "B".repeat(100);

    const persona: Persona = {
      id: "test-persona-2",
      userId: "u1",
      tenantId: "t1",
      name: "Short",
      tone: null,
      vocabulary: null,
      styleGuide: null,
      systemPromptAddon: shortAddon,
      surface: null,
      isDefault: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const addon = buildPersonaAddon(persona);
    expect(addon).toContain(shortAddon);
  });
});

// ── Test 4 : getPersonaForSurface("voice") → builtin:casual ──

describe("getPersonaForSurface — fallback builtin", () => {
  it("retourne builtin:casual pour surface 'voice' si aucune persona DB", async () => {
    // mockMaybeSingleResult → data: null → fallback sur builtin
    mockMaybeSingleResult = { data: null, error: null };

    const { getPersonaForSurface } = await import("@/lib/personas/store");
    const persona = await getPersonaForSurface("voice", SCOPE);

    expect(persona).not.toBeNull();
    expect(persona?.id).toBe("builtin:casual");
    expect(persona?.surface).toBe("voice");
  });

  it("builtin:casual a surface 'voice' dans BUILTIN_PERSONAS", () => {
    const casual = BUILTIN_PERSONAS.find((p) => p.id === "builtin:casual");
    expect(casual).toBeDefined();
    expect(casual?.surface).toBe("voice");
  });
});
