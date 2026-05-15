/**
 * Arcjet — rate limiting + bot detection + shield.
 * Branché dans proxy.ts (Next.js 16).
 *
 * No-op si ARCJET_KEY absent — proxy.ts vérifie isArcjetEnabled() avant
 * tout appel. Sans clé, les routes sont protégées uniquement par l'auth session.
 *
 * Trois instances :
 *  - `aj`            : règles générales (100 req/min/IP) — auth, missions
 *  - `ajOrchestrate` : règles strictes (10 req/min/IP) — /api/orchestrate uniquement
 *    Justification : chaque hit orchestrate = 1 appel LLM Anthropic (~$0.01-0.10).
 *    10 req/min laisse une conversation normale tout en bloquant le spam.
 *  - `ajLlmJobs`     : règles intermédiaires (20 req/min/IP) — routes IA coûteuses
 *    (jobs FAL/E2B/ElevenLabs/LlamaCloud, assets/diff Anthropic, personas/ab-test).
 *    Justification : chaque hit déclenche 1 appel provider externe payant
 *    ($0.002-$0.30 selon le provider). 20 req/min couvre les workflows légitimes
 *    (générer plusieurs assets en burst) tout en bloquant le DoS budgétaire.
 */

import arcjet, { detectBot, shield, tokenBucket } from "@arcjet/next";
import { type NextRequest, NextResponse } from "next/server";

const KEY = process.env.ARCJET_KEY;
// En dev, le renderer Electron est flagué comme bot et casse NextAuth.
// DRY_RUN = on log sans bloquer.
const MODE = process.env.NODE_ENV === "development" ? "DRY_RUN" : "LIVE";

export const isArcjetEnabled = (): boolean => Boolean(KEY);

const baseRules = [
  shield({ mode: MODE }),
  detectBot({
    mode: MODE,
    allow: ["CATEGORY:SEARCH_ENGINE", "CATEGORY:MONITOR", "CATEGORY:PREVIEW"],
  }),
];

export const aj = KEY
  ? arcjet({
      key: KEY,
      characteristics: ["ip.src"],
      rules: [
        ...baseRules,
        tokenBucket({
          mode: MODE,
          characteristics: ["ip.src"],
          refillRate: 60,
          interval: 60,
          capacity: 100,
        }),
      ],
    })
  : null;

// Instance dédiée pour /api/orchestrate — limite stricte (coût LLM)
export const ajOrchestrate = KEY
  ? arcjet({
      key: KEY,
      characteristics: ["ip.src"],
      rules: [
        ...baseRules,
        tokenBucket({
          mode: MODE,
          characteristics: ["ip.src"],
          refillRate: 10,
          interval: 60,
          capacity: 10,
        }),
      ],
    })
  : null;

// Instance dédiée pour les jobs IA externes — quota intermédiaire
// (entre `aj` 100 req/min et `ajOrchestrate` 10 req/min).
// Cible : routes qui déclenchent 1 appel provider payant par requête
// (FAL, E2B, ElevenLabs, LlamaCloud, Anthropic hors orchestrate).
export const ajLlmJobs = KEY
  ? arcjet({
      key: KEY,
      characteristics: ["ip.src"],
      rules: [
        ...baseRules,
        tokenBucket({
          mode: MODE,
          characteristics: ["ip.src"],
          refillRate: 20,
          interval: 60,
          capacity: 20,
        }),
      ],
    })
  : null;

/**
 * Helper de défense en profondeur pour les handlers de jobs IA payants.
 *
 * Le proxy Next.js (`proxy.ts`) applique déjà `ajLlmJobs` sur ces routes,
 * mais ce helper offre une protection redondante au niveau handler :
 *  - couvre le cas où une route serait appelée hors-proxy (server action,
 *    RSC interne, regression future du `matcher`)
 *  - garantit que la décision d'Arcjet est respectée même si quelqu'un
 *    bypasse le proxy en injectant un appel direct au handler
 *
 * No-op gracieux si ARCJET_KEY absente (`ajLlmJobs === null`).
 *
 * Usage :
 * ```ts
 * const denied = await protectLlmJob(req);
 * if (denied) return denied;
 * ```
 *
 * @returns NextResponse 429/403 si bloqué, null sinon (continuer le handler).
 */
export async function protectLlmJob(req: NextRequest): Promise<NextResponse | null> {
  if (!ajLlmJobs) return null;
  const decision = await ajLlmJobs.protect(req, { requested: 1 });
  if (!decision.isDenied()) return null;
  if (decision.reason.isRateLimit()) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  if (decision.reason.isBot()) {
    return NextResponse.json({ error: "bot_detected" }, { status: 403 });
  }
  if (decision.reason.isShield()) {
    return NextResponse.json({ error: "request_blocked" }, { status: 403 });
  }
  return NextResponse.json({ error: "denied" }, { status: 403 });
}
