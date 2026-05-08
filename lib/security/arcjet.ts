/**
 * Arcjet — rate limiting + bot detection + shield.
 * Branché dans proxy.ts (Next.js 16).
 *
 * No-op si ARCJET_KEY absent — proxy.ts vérifie isArcjetEnabled() avant
 * tout appel. Sans clé, les routes sont protégées uniquement par l'auth session.
 *
 * Deux instances :
 *  - `aj`            : règles générales (100 req/min/IP) — auth, missions, jobs
 *  - `ajOrchestrate` : règles strictes (10 req/min/IP) — /api/orchestrate uniquement
 *    Justification : chaque hit orchestrate = 1 appel LLM Anthropic (~$0.01-0.10).
 *    10 req/min laisse une conversation normale tout en bloquant le spam.
 */

import arcjet, { tokenBucket, detectBot, shield } from "@arcjet/next";

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
