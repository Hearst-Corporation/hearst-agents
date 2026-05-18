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
  /**
   * Identifiant Stripe `event.id` — clé d'idempotence canonique (P1-3).
   * Quand il est fourni, le webhook a DÉJÀ inséré la ligne stripe_events
   * (insert-first ON CONFLICT) avant d'appeler grantCredits : la garde
   * d'idempotence repose donc entièrement sur cet event.id côté webhook et
   * grantCredits ne ré-écrit pas stripe_events (sinon collision 23505).
   */
  eventId?: string;
  /**
   * `session.id` Stripe — conservé pour rétro-compat avec d'éventuels
   * callers non-webhook qui n'ont pas d'event.id. Sert uniquement de clé
   * de dédup secondaire (check-then-act) si `eventId` est absent.
   */
  sessionId?: string;
  adminId?: string;
  tenantId?: string;
}

/**
 * Ajoute des crédits au solde d'un user et trace dans le ledger.
 *
 * Idempotence (P1-3) :
 *  - Si `meta.eventId` est fourni (chemin webhook Stripe), la garde est
 *    assurée EN AMONT par l'insert-first atomique sur stripe_events. Ici on
 *    crédite directement sans relire/réécrire stripe_events.
 *  - Sinon, dédup legacy best-effort sur `meta.sessionId` (callers hors
 *    webhook) — check-then-act, non atomique mais suffisant hors concurrence.
 *
 * Le tenantId doit être fourni explicitement (webhook metadata) pour éviter
 * le guess via SELECT sur user_credits.
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

  // Idempotence legacy : uniquement si AUCUN eventId fourni (chemin non
  // webhook). Quand le webhook passe meta.eventId, la garde atomique a déjà
  // été faite en amont (insert-first sur stripe_events) — on ne relit pas ici
  // pour éviter de dépendre d'une clé différente (session.id vs event.id).
  if (!meta.eventId && meta.sessionId) {
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
  const { error } = await sb.rpc("grant_credits_v2", {
    p_user_id: userId,
    p_tenant_id: meta.tenantId ?? "default",
    p_amount_usd: amountUsd,
    p_source: meta.source,
    p_description: `Credit grant via ${meta.source}${meta.sessionId ? ` (session: ${meta.sessionId})` : ""}`,
  });

  if (error) {
    console.error("[grantCredits] RPC failed:", error.message);
    return { success: false, error: error.message };
  }

  // Tracer pour idempotence — UNIQUEMENT pour le chemin legacy sans eventId.
  // Sur le chemin webhook (meta.eventId présent), la ligne stripe_events a
  // déjà été créée en amont avec event.id : on ne ré-écrit pas une clé
  // distincte (session.id) qui dédoublerait la garde et casserait
  // l'unicité voulue sur event.id.
  if (!meta.eventId && meta.sessionId) {
    await sb.from("stripe_events").upsert({
      stripe_event_id: meta.sessionId,
      processed_at: new Date().toISOString(),
      amount_usd: amountUsd,
      user_id: userId,
    });
  }

  return { success: true };
}
