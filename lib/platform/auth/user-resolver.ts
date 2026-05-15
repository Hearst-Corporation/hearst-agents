/**
 * User resolver — Email → UUID via RPC atomique create_user_with_tenant.
 *
 * Appelé par le callback NextAuth jwt() au premier login (et à chaque
 * refresh OAuth). Délègue à la RPC Postgres qui gère en une transaction :
 *   1. UPSERT public.users sur (email)
 *   2. INSERT public.tenants si le user n'a pas encore de primary_tenant_id
 *   3. UPDATE users.primary_tenant_id / primary_workspace_id / tenant_ids
 *
 * Idempotent : si le user existe et a déjà un tenant, retourne son id
 * sans aucune modification (no-op côté tenant).
 *
 * Prérequis schéma : migration 0071_create_user_with_tenant_rpc.sql appliquée.
 *
 * Sans Supabase service role (NEXT_PUBLIC_SUPABASE_URL +
 * SUPABASE_SERVICE_ROLE_KEY) : retourne null. Le callback NextAuth log
 * un warning et token.userId reste undefined → user pas authentifié pour
 * les routes auth-required.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerSupabase } from "@/lib/platform/db/supabase";

export async function resolveOrCreateUserUuid(email: string): Promise<string | null> {
  if (!email) return null;
  const sb = getServerSupabase();
  if (!sb) {
    console.warn("[UserResolver] Supabase service role not configured");
    return null;
  }

  // RPC atomique : INSERT user + INSERT tenant (si besoin) + UPDATE user
  // dans une seule transaction Postgres. Élimine le risque d'user orphelin
  // (users.primary_tenant_id NOT NULL depuis migration 0070).
  const { data, error } = await sb.rpc("create_user_with_tenant", {
    p_email: email,
  });

  if (error || !data) {
    console.error("[UserResolver] rpc create_user_with_tenant failed:", error?.message);
    return null;
  }

  return data as string;
}
