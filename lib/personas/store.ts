/**
 * Personas store — CRUD scopé user_id + tenant_id sur la table `personas`.
 *
 * Fail-soft : si Supabase est indisponible (env locales sans DB), `listPersonasForUser`
 * et `getPersonaById` renvoient les valeurs in-memory builtins (lib/personas/defaults.ts)
 * pour ne jamais bloquer l'UI ni l'orchestrateur.
 */

import type { Database } from "@/lib/database.types";
import { getServerSupabase } from "@/lib/platform/db/supabase";
import { BUILTIN_PERSONAS } from "./defaults";
import type {
  Persona,
  PersonaInsert,
  PersonaTone,
  PersonaUpdate,
  PersonaVocabulary,
} from "./types";

type PersonaRow = Database["public"]["Tables"]["personas"]["Row"];

function rowToPersona(row: PersonaRow): Persona {
  return {
    id: row.id,
    userId: row.user_id,
    tenantId: row.tenant_id,
    name: row.name,
    description: row.description ?? undefined,
    tone: (row.tone as PersonaTone | null) ?? null,
    vocabulary: (row.vocabulary as PersonaVocabulary | null) ?? null,
    styleGuide: row.style_guide,
    systemPromptAddon: row.system_prompt_addon,
    surface: row.surface,
    isDefault: row.is_default,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listPersonasForUser(userId: string, tenantId: string): Promise<Persona[]> {
  const db = getServerSupabase();
  if (!db) {
    return BUILTIN_PERSONAS.map((p) => ({
      ...p,
      userId,
      tenantId,
    }));
  }

  const { data, error } = await db
    .from("personas")
    .select("*")
    .eq("user_id", userId)
    .eq("tenant_id", tenantId)
    .order("is_default", { ascending: false })
    .order("name", { ascending: true });

  if (error) {
    console.warn("[personas/store] list failed:", error.message);
    return BUILTIN_PERSONAS.map((p) => ({ ...p, userId, tenantId }));
  }

  return ((data ?? []) as PersonaRow[]).map(rowToPersona);
}

export async function getPersonaById(
  id: string,
  scope: { userId: string; tenantId: string },
): Promise<Persona | null> {
  const builtin = BUILTIN_PERSONAS.find((p) => p.id === id);
  if (builtin) {
    return { ...builtin, userId: scope.userId, tenantId: scope.tenantId };
  }

  const db = getServerSupabase();
  if (!db) return null;

  const { data, error } = await db
    .from("personas")
    .select("*")
    .eq("id", id)
    .eq("user_id", scope.userId)
    .eq("tenant_id", scope.tenantId)
    .maybeSingle();

  if (error || !data) return null;
  return rowToPersona(data as PersonaRow);
}

export async function getDefaultPersona(scope: {
  userId: string;
  tenantId: string;
}): Promise<Persona | null> {
  const db = getServerSupabase();
  if (!db) {
    const builtin = BUILTIN_PERSONAS.find((p) => p.isDefault) ?? null;
    return builtin ? { ...builtin, userId: scope.userId, tenantId: scope.tenantId } : null;
  }

  const { data, error } = await db
    .from("personas")
    .select("*")
    .eq("user_id", scope.userId)
    .eq("tenant_id", scope.tenantId)
    .eq("is_default", true)
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    const builtin = BUILTIN_PERSONAS.find((p) => p.isDefault) ?? null;
    return builtin ? { ...builtin, userId: scope.userId, tenantId: scope.tenantId } : null;
  }
  return rowToPersona(data as PersonaRow);
}

/**
 * Fallback vertical-aware : si tenant.industry est verticale (ex: hospitality),
 * ET qu'aucune persona DB ne match la surface, ET qu'aucun builtin ne match
 * la surface non plus, on retourne le builtin vertical (hospitality-concierge).
 *
 * Custom user persona prévaut toujours (jamais override).
 */
async function getVerticalFallbackPersona(scope: {
  userId: string;
  tenantId: string;
}): Promise<Persona | null> {
  try {
    // Lazy import pour éviter cycle (verticals/hospitality importe peut-être
    // d'autres modules personas dans une future itération).
    const { getTenantIndustry } = await import("@/lib/verticals/hospitality");
    const industry = await getTenantIndustry(scope.tenantId);
    if (industry !== "hospitality") return null;
    const builtin = BUILTIN_PERSONAS.find((p) => p.id === "builtin:hospitality-concierge");
    if (!builtin) return null;
    return { ...builtin, userId: scope.userId, tenantId: scope.tenantId };
  } catch {
    return null;
  }
}

export async function getPersonaForSurface(
  surface: string,
  scope: { userId: string; tenantId: string },
): Promise<Persona | null> {
  const db = getServerSupabase();
  if (!db) {
    const builtin = BUILTIN_PERSONAS.find((p) => p.surface === surface) ?? null;
    if (builtin) {
      return { ...builtin, userId: scope.userId, tenantId: scope.tenantId };
    }
    // Fallback vertical
    return await getVerticalFallbackPersona(scope);
  }

  const { data, error } = await db
    .from("personas")
    .select("*")
    .eq("user_id", scope.userId)
    .eq("tenant_id", scope.tenantId)
    .eq("surface", surface)
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    const builtin = BUILTIN_PERSONAS.find((p) => p.surface === surface) ?? null;
    if (builtin) {
      return { ...builtin, userId: scope.userId, tenantId: scope.tenantId };
    }
    // Fallback vertical (hospitality-concierge si tenant.industry === "hospitality")
    return await getVerticalFallbackPersona(scope);
  }
  return rowToPersona(data as PersonaRow);
}

export async function createPersona(input: PersonaInsert): Promise<Persona> {
  const db = getServerSupabase();
  if (!db) {
    throw new Error("personas/store: Supabase unavailable");
  }

  if (input.isDefault) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db.from("personas" as any) as any)
      .update({ is_default: false })
      .eq("user_id", input.userId)
      .eq("tenant_id", input.tenantId);
  }

  const { data, error } = await db
    .from("personas")
    .insert({
      user_id: input.userId,
      tenant_id: input.tenantId,
      name: input.name,
      description: input.description ?? null,
      tone: input.tone ?? null,
      vocabulary: (input.vocabulary ??
        null) as Database["public"]["Tables"]["personas"]["Insert"]["vocabulary"],
      style_guide: input.styleGuide ?? null,
      system_prompt_addon: input.systemPromptAddon ?? null,
      surface: input.surface ?? null,
      is_default: input.isDefault ?? false,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`personas/store: create failed: ${error.message}`);
  }
  return rowToPersona(data as PersonaRow);
}

export async function updatePersona(
  id: string,
  scope: { userId: string; tenantId: string },
  patch: PersonaUpdate,
): Promise<Persona | null> {
  const db = getServerSupabase();
  if (!db) return null;

  if (patch.isDefault === true) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db.from("personas" as any) as any)
      .update({ is_default: false })
      .eq("user_id", scope.userId)
      .eq("tenant_id", scope.tenantId);
  }

  type PersonaUpdate = Database["public"]["Tables"]["personas"]["Update"];
  const updateRow: PersonaUpdate = {
    updated_at: new Date().toISOString(),
  };
  if (patch.name !== undefined) updateRow.name = patch.name;
  if (patch.description !== undefined) updateRow.description = patch.description;
  if (patch.tone !== undefined) updateRow.tone = patch.tone;
  if (patch.vocabulary !== undefined)
    updateRow.vocabulary =
      patch.vocabulary as Database["public"]["Tables"]["personas"]["Update"]["vocabulary"];
  if (patch.styleGuide !== undefined) updateRow.style_guide = patch.styleGuide;
  if (patch.systemPromptAddon !== undefined)
    updateRow.system_prompt_addon = patch.systemPromptAddon;
  if (patch.surface !== undefined) updateRow.surface = patch.surface;
  if (patch.isDefault !== undefined) updateRow.is_default = patch.isDefault;

  const { data, error } = await db
    .from("personas")
    .update(updateRow)
    .eq("id", id)
    .eq("user_id", scope.userId)
    .eq("tenant_id", scope.tenantId)
    .select("*")
    .maybeSingle();

  if (error || !data) return null;
  return rowToPersona(data as PersonaRow);
}

export async function deletePersona(
  id: string,
  scope: { userId: string; tenantId: string },
): Promise<boolean> {
  const db = getServerSupabase();
  if (!db) return false;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (db.from("personas" as any) as any)
    .delete()
    .eq("id", id)
    .eq("user_id", scope.userId)
    .eq("tenant_id", scope.tenantId);

  if (error) {
    console.warn("[personas/store] delete failed:", error.message);
    return false;
  }
  return true;
}
