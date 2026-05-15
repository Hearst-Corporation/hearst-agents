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

  // Idempotence : vérifier si cet event Stripe a déjà été traité
  const { getServerSupabase } = await import("@/lib/platform/db/supabase");
  const sb = getServerSupabase();
  if (sb) {
    const { data: existing } = await sb
      .from("stripe_events")
      .select("id")
      .eq("stripe_event_id", event.id)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ received: true, processed: false, reason: "already_processed" });
    }
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as import("stripe").Stripe.Checkout.Session;
    if (session.payment_status === "paid") {
      const userId = session.client_reference_id;
      const amountUsd = Number(session.metadata?.amountUsd);
      const tenantId = session.metadata?.tenantId as string | undefined;
      if (userId && amountUsd > 0) {
        const { grantCredits } = await import("@/lib/credits/grant");
        await grantCredits(userId, amountUsd, {
          source: "stripe_topup",
          sessionId: session.id,
          tenantId,
        });
      }
    }
  }

  // Tracer l'event pour idempotence
  if (sb) {
    await sb.from("stripe_events").upsert({
      stripe_event_id: event.id,
      processed_at: new Date().toISOString(),
    });
  }

  return NextResponse.json({ received: true, processed: true });
}
