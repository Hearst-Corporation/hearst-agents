/**
 * Grant credits — ajoute des crédits au solde d'un user.
 *
 * Utilisé par :
 *   - Webhook Stripe (top-up self-serve)
 *   - Admin grant (manuel)
 *   - Trial grant (onboarding)
 *
 * Toutes les écritures passent par RPC SECURITY DEFINER pour garantir
 * l'atomicité. Le ledger trace la source pour l'audit.
 */

import { getServerSupabase } from "@/lib/platform/db/supabase";

export interface GrantCreditsMeta {
  source: string;
  sessionId?: string;
  adminId?: string;
}

/**
 * Ajoute des crédits au solde d'un user et trace dans le ledger.
 * Idempotent : même sessionId = même opération, pas de double-crédit.
 */
export async function grantCredits(
  userId: string,
  amountUsd: number,
  meta: GrantCreditsMeta,
): Promise<{ success: boolean; error?: string }> {
  const sb = getServerSupabase();
  if (!sb) {
    return { success: false, error: "No database connection" };
  }

  // Idempotence : vérifier si ce sessionId a déjà été traité
  if (meta.sessionId) {
    const { data: existing } = await sb
      .from("stripe_events")
      .select("id")
      .eq("stripe_event_id", meta.sessionId)
      .maybeSingle();

    if (existing) {
      return { success: true }; // Déjà traité, idempotent
    }
  }

  // Appel RPC pour créditer
  const { error } = await sb.rpc("grant_credits", {
    p_user_id: userId,
    p_amount_usd: amountUsd,
    p_source: meta.source,
    p_description: `Credit grant via ${meta.source}${meta.sessionId ? ` (session: ${meta.sessionId})` : ""}`,
  });

  if (error) {
    console.error("[grantCredits] RPC failed:", error.message);
    return { success: false, error: error.message };
  }

  // Tracer l'event Stripe pour idempotence
  if (meta.sessionId) {
    await sb.from("stripe_events").upsert({
      stripe_event_id: meta.sessionId,
      processed_at: new Date().toISOString(),
      amount_usd: amountUsd,
      user_id: userId,
    });
  }

  return { success: true };
}
