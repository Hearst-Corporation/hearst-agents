/**
 * POST /api/webhooks/stripe — webhook Stripe pour `checkout.session.completed`.
 *
 * P1-2 scaffold : route opérationnelle dès que `lib/credits/stripe.ts` est
 * activé. En attendant, retourne 501 mais avec une signature validée pour
 * permettre de tester l'intégration Stripe sans crash.
 *
 * Sécurité :
 *  - Signature header `stripe-signature` validée via `STRIPE_WEBHOOK_SECRET`
 *  - Crédite seulement si `event.type === "checkout.session.completed"` ET
 *    `session.payment_status === "paid"`
 *  - Idempotence via `event.id` (à activer en phase 2 : log table stripe_events)
 *
 * Pas d'auth user — c'est Stripe qui appelle. La validation HMAC suffit.
 */

import { NextResponse } from "next/server";
import { verifyStripeWebhook } from "@/lib/credits/stripe";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  // Stripe demande le raw body — Next.js fait passer le stream à req.text().
  const rawBody = await req.text();

  const verified = await verifyStripeWebhook(rawBody, signature);
  if (!verified.ok) {
    console.warn(`[stripe webhook] verification failed: ${verified.error}`);
    return NextResponse.json({ error: verified.error }, { status: 400 });
  }

  const event = verified.event as import("stripe").Stripe.Event;

  // Idempotence atomique (P1-3) : insert-first ON CONFLICT.
  // L'ancien check-then-act (SELECT puis INSERT) laissait passer 2 livraisons
  // concurrentes du même event.id → double grantCredits. On s'appuie désormais
  // sur la contrainte UNIQUE(stripe_event_id) (migration 0086) : seule la
  // requête qui a effectivement créé la ligne procède au crédit.
  //
  // P0-A (récupérabilité) : la table stripe_events n'a PAS de colonne `status`
  // et `processed_at` est NOT NULL DEFAULT now() — impossible d'encoder un état
  // "pending" sans migration (gérée par une autre stream). On adopte donc le
  // pattern "réservation + delete-on-failure" :
  //   1. INSERT  = réservation (garde anti-concurrence via UNIQUE)
  //   2. grantCredits
  //   3a. succès → la ligne reste (idempotence définitive) → 200
  //   3b. échec  → DELETE la réservation + HTTP 500 → Stripe rejoue contre un
  //       état propre et le crédit finit par être accordé. PLUS de perte
  //       silencieuse (client payé / zéro crédit / non récupérable).
  const { getServerSupabase } = await import("@/lib/platform/db/supabase");
  const sb = getServerSupabase();
  let reservationCreated = false;
  if (sb) {
    const { data: inserted, error: insertErr } = await sb
      .from("stripe_events")
      .insert({
        stripe_event_id: event.id,
        processed_at: new Date().toISOString(),
      })
      .select("id");

    // 23505 = unique_violation Postgres → event déjà traité (succès antérieur)
    // OU réservé par une livraison concurrente. On ne re-crédite pas.
    if (insertErr) {
      if (insertErr.code === "23505") {
        return NextResponse.json({ received: true, processed: false, reason: "already_processed" });
      }
      console.error(`[stripe webhook] stripe_events insert failed: ${insertErr.message}`);
      return NextResponse.json({ error: "idempotency_store_failed" }, { status: 500 });
    }

    // Sécurité supplémentaire : si l'insert n'a rien retourné (aucune ligne
    // créée), on considère l'event déjà traité — pas de crédit.
    if (!inserted || inserted.length === 0) {
      return NextResponse.json({ received: true, processed: false, reason: "already_processed" });
    }

    reservationCreated = true;
  }

  // Libère la réservation stripe_events si le crédit échoue, pour que le
  // replay Stripe (ou un replay manuel) reparte d'un état propre au lieu de
  // buter sur un 23505 définitif.
  const releaseReservation = async (): Promise<void> => {
    if (!sb || !reservationCreated) return;
    const { error: delErr } = await sb
      .from("stripe_events")
      .delete()
      .eq("stripe_event_id", event.id);
    if (delErr) {
      console.error(
        `[stripe webhook] failed to release stripe_events reservation for ${event.id}: ${delErr.message}`,
      );
    }
  };

  // À partir d'ici : la ligne stripe_events a bien été créée par CETTE requête,
  // donc le crédit ne sera émis qu'une seule fois pour cet event.id.
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as import("stripe").Stripe.Checkout.Session;
    if (session.payment_status === "paid") {
      const userId = session.client_reference_id;
      const amountUsd = Number(session.metadata?.amountUsd);
      const tenantId = session.metadata?.tenantId as string | undefined;
      if (userId && amountUsd > 0) {
        const { grantCredits } = await import("@/lib/credits/grant");
        let grantResult: { success: boolean; error?: string };
        try {
          grantResult = await grantCredits(userId, amountUsd, {
            source: "stripe_topup",
            eventId: event.id,
            sessionId: session.id,
            tenantId,
          });
        } catch (grantThrow) {
          // grantCredits ne devrait pas throw (return {success:false}), mais
          // on couvre le cas pour ne JAMAIS laisser une réservation fantôme.
          const msg = grantThrow instanceof Error ? grantThrow.message : String(grantThrow);
          console.error(`[stripe webhook] grantCredits threw for ${event.id}: ${msg}`);
          grantResult = { success: false, error: msg };
        }

        if (!grantResult.success) {
          // CLIENT PAYÉ mais crédit non accordé → on libère la réservation et
          // on renvoie 500 pour forcer le retry Stripe contre un état propre.
          console.error(
            `[stripe webhook] grantCredits failed for ${event.id}: ${grantResult.error ?? "unknown"} — releasing reservation, will retry`,
          );
          await releaseReservation();
          return NextResponse.json(
            { error: "credit_grant_failed", retryable: true },
            { status: 500 },
          );
        }
      }
    }
  }

  return NextResponse.json({ received: true, processed: true });
}
