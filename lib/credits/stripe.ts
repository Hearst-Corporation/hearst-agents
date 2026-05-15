/**
 * Stripe credits top-up — activé.
 *
 * Flow :
 *   1. UI ChatDock affiche TopUpModal quand solde < $1
 *   2. POST /api/v2/credits/top-up { amountUsd } → renvoie url Checkout
 *   3. User paye sur Stripe
 *   4. Stripe webhook → /api/webhooks/stripe → grantCredits(userId, amountUsd)
 *
 * Configuration requise :
 *   - STRIPE_SECRET_KEY
 *   - STRIPE_PRICE_ID_5, STRIPE_PRICE_ID_20, STRIPE_PRICE_ID_50
 *   - STRIPE_WEBHOOK_SECRET
 */

export interface StripeTopUpPrice {
  /** Identifiant Stripe Price (`price_xxx`). */
  priceId: string;
  /** Montant USD crédité à l'utilisateur. */
  amountUsd: number;
}

/**
 * Liste des prix Stripe configurés. Chaque entrée correspond à un Product/Price
 * créé dans Stripe Dashboard. À renseigner via env vars pour ne pas hardcoder.
 *
 * Convention : `STRIPE_PRICE_ID_5`, `STRIPE_PRICE_ID_20`, `STRIPE_PRICE_ID_50`.
 */
export function getAvailableTopUpPrices(): StripeTopUpPrice[] {
  const prices: StripeTopUpPrice[] = [];
  const candidates: Array<{ envKey: string; amountUsd: number }> = [
    { envKey: "STRIPE_PRICE_ID_5", amountUsd: 5 },
    { envKey: "STRIPE_PRICE_ID_20", amountUsd: 20 },
    { envKey: "STRIPE_PRICE_ID_50", amountUsd: 50 },
  ];
  for (const { envKey, amountUsd } of candidates) {
    const priceId = process.env[envKey];
    if (priceId) prices.push({ priceId, amountUsd });
  }
  return prices;
}

/**
 * Indique si Stripe est configuré (clé + au moins un prix).
 * Les routes top-up retournent 501 si false (clear error pour l'UI).
 */
export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY) && getAvailableTopUpPrices().length > 0;
}

/**
 * Crée une session Stripe Checkout pour recharger les crédits d'un user.
 *
 * À activer après installation du SDK Stripe :
 * ```ts
 * import Stripe from "stripe";
 * const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
 * const session = await stripe.checkout.sessions.create({...});
 * return session.url;
 * ```
 */
export async function createCheckoutSession(args: {
  userId: string;
  tenantId: string;
  priceId: string;
  amountUsd: number;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ url: string } | { error: string; errorCode: string }> {
  if (!isStripeConfigured()) {
    return {
      error: "Stripe n'est pas configuré (clé/prix manquants). Activation requise.",
      errorCode: "STRIPE_NOT_CONFIGURED",
    };
  }

  const Stripe = (await import("stripe")) as unknown as new (
    key: string,
    opts: { apiVersion: string },
  ) => import("stripe").Stripe;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2025-02-24.acacia",
  });

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: args.priceId, quantity: 1 }],
    success_url: args.successUrl,
    cancel_url: args.cancelUrl,
    client_reference_id: args.userId,
    metadata: { tenantId: args.tenantId, amountUsd: String(args.amountUsd), userId: args.userId },
  });

  if (!session.url) {
    return { error: "Stripe session sans URL", errorCode: "STRIPE_SESSION_ERROR" };
  }

  return { url: session.url };
}

/**
 * Valide la signature d'un webhook Stripe et retourne l'event parsé.
 *
 * À activer après installation du SDK :
 * ```ts
 * import Stripe from "stripe";
 * const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
 * const event = stripe.webhooks.constructEvent(
 *   body,
 *   signature,
 *   process.env.STRIPE_WEBHOOK_SECRET!,
 * );
 * return event;
 * ```
 */
export async function verifyStripeWebhook(
  body: string,
  signature: string,
): Promise<{ ok: true; event: unknown } | { ok: false; error: string }> {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return { ok: false, error: "STRIPE_WEBHOOK_SECRET absent" };
  }

  try {
    const Stripe = (await import("stripe")) as unknown as new (
      key: string,
      opts: { apiVersion: string },
    ) => import("stripe").Stripe;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2025-02-24.acacia",
    });
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
    return { ok: true, event };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Webhook verification failed: ${msg}` };
  }
}
