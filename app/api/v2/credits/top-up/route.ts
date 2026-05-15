/**
 * POST /api/v2/credits/top-up — Stripe Checkout self-serve recharge crédits.
 *
 * P1-2 scaffold : route opérationnelle dès que `lib/credits/stripe.ts` est
 * activé (SDK installé + env vars renseignées). En attendant, retourne 501
 * avec un message clair pour le UI.
 *
 * Body : { amountUsd: number } — doit matcher un prix Stripe configuré.
 * Response 200 : { url: string } — URL Stripe Checkout
 * Response 501 : { error, errorCode } si Stripe non configuré
 * Response 400 : si amountUsd invalide / non supporté
 */

import { NextResponse } from "next/server";
import {
  createCheckoutSession,
  getAvailableTopUpPrices,
  isStripeConfigured,
} from "@/lib/credits/stripe";
import { requireScope } from "@/lib/platform/auth/scope";

export const dynamic = "force-dynamic";

interface TopUpRequest {
  amountUsd: number;
}

export async function POST(req: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      {
        error: "Top-up indisponible — Stripe pas encore activé côté serveur.",
        errorCode: "STRIPE_NOT_CONFIGURED",
      },
      { status: 501 },
    );
  }

  const guard = await requireScope({ requireTenant: true });
  if (guard.error) {
    return NextResponse.json({ error: guard.error.message }, { status: guard.error.status });
  }
  const { scope } = guard;

  let body: TopUpRequest;
  try {
    body = (await req.json()) as TopUpRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const amount = Number(body.amountUsd);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "amountUsd must be > 0" }, { status: 400 });
  }

  const prices = getAvailableTopUpPrices();
  const match = prices.find((p) => p.amountUsd === amount);
  if (!match) {
    return NextResponse.json(
      {
        error: `Montant non supporté. Montants disponibles : ${prices.map((p) => `$${p.amountUsd}`).join(", ")}`,
        availableAmounts: prices.map((p) => p.amountUsd),
      },
      { status: 400 },
    );
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:4102";
  const result = await createCheckoutSession({
    userId: scope.userId,
    tenantId: scope.tenantId,
    priceId: match.priceId,
    amountUsd: match.amountUsd,
    successUrl: `${baseUrl}/credits/success?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${baseUrl}/credits/cancel`,
  });

  if ("error" in result) {
    return NextResponse.json(result, { status: 501 });
  }

  return NextResponse.json({ url: result.url });
}
