import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../database.types";

let _client: SupabaseClient<Database> | null = null;

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = Buffer.from(parts[1], "base64url").toString("utf8");
    return JSON.parse(payload) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function extractSupabaseRef(url: string): string | null {
  try {
    const host = new URL(url).hostname;
    // Format: <ref>.supabase.co
    const match = host.match(/^([a-z0-9]+)\.supabase\.co$/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export function getServerSupabase(): SupabaseClient<Database> | null {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return null;

  // P0 — Diagnostic mismatch service-role key vs URL (Bloquant 5 audit)
  const isProd = process.env.NODE_ENV === "production";
  const jwtPayload = decodeJwtPayload(key);
  const jwtRef = typeof jwtPayload?.ref === "string" ? jwtPayload.ref : null;
  const urlRef = extractSupabaseRef(url);

  if (jwtRef && urlRef && jwtRef !== urlRef) {
    const msg =
      `[supabase] MISMATCH DETECTED: SUPABASE_SERVICE_ROLE_KEY ref (${jwtRef}) !== NEXT_PUBLIC_SUPABASE_URL ref (${urlRef}). ` +
      "Le client service-role risque de pointer vers un projet obsolète. " +
      "Régénérez la clé dans le dashboard Supabase du projet cible.";
    console.error(msg);
    if (isProd) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY project mismatch — refusing to boot");
    }
  }

  _client = createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return _client;
}

export function requireServerSupabase(): SupabaseClient<Database> {
  const sb = getServerSupabase();
  if (!sb) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return sb;
}

export type { Database, SupabaseClient };
