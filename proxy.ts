/**
 * Next.js Proxy — Global Auth Guard + Arcjet Edge Protection + CSP Nonce
 *
 * Canonical request guard for Next.js 16 / Turbopack.
 * It runs before route handlers and enforces:
 * 1. Arcjet protection (rate limit + bot detection + shield) sur routes critiques
 * 2. Authentication (session or API key)
 * 3. Public path exemptions
 * 4. Explicit dev bypass only
 * 5. CSP nonce-based (F-078) — supprime 'unsafe-inline' sur script-src en prod
 *
 * F-022 : env.server validation est effectuée en lazy import (dans proxy())
 * plutôt qu'à l'import statique. Un throw au boot ne crash plus le middleware
 * Vercel Edge — il produit une 500 loguée à la première requête.
 *
 * F-078 (CSP nonce) : le Content-Security-Policy est construit ici avec un
 * nonce unique par requête. 'unsafe-inline' est supprimé de script-src en prod
 * et remplacé par 'nonce-${nonce}' + 'strict-dynamic'. Le nonce est posé sur
 * les request headers (x-nonce) pour que Next.js l'injecte dans ses scripts
 * bootstrap, et sur les response headers (Content-Security-Policy).
 */

import { randomUUID, timingSafeEqual } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { isDevBypassEnabled } from "@/lib/platform/auth/dev-bypass";
import { aj, ajLlmJobs, ajOrchestrate, isArcjetEnabled } from "@/lib/security/arcjet";

const isDev = process.env.NODE_ENV === "development";

/* ── F-078: CSP nonce-based ───────────────────────────────────────────────────
   Construit la directive CSP complète avec un nonce unique par requête.

   NOTES SUR LES CHOIX :
   - script-src PROD : 'nonce-${nonce}' + 'strict-dynamic' remplacent
     'unsafe-inline'. 'strict-dynamic' propage la confiance aux scripts chargés
     dynamiquement par les scripts noncés (pattern requis pour React / Next.js).
   - script-src DEV : 'unsafe-eval' + 'wasm-unsafe-eval' conservés pour le HMR
     Next.js (Fast Refresh nécessite eval). 'unsafe-inline' retiré même en dev.
   - style-src 'unsafe-inline' conservé volontairement : les attributs
     style={{}} React inline ne sont pas couvrables par nonce/hash (limitation
     spec CSP3 — les nonces ne s'appliquent pas aux attributs style, seulement
     aux balises <style>). Cible du durcissement = script-src uniquement.
*/
function buildCsp(nonce: string, dev: boolean): string {
  const scriptSrc = dev
    ? `'self' 'nonce-${nonce}' 'unsafe-eval' 'wasm-unsafe-eval' https://*.sentry.io https://cloud.langfuse.com https://unpkg.com`
    : `'self' 'nonce-${nonce}' 'strict-dynamic' https://*.sentry.io https://cloud.langfuse.com https://unpkg.com`;

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    // style-src 'unsafe-inline' conservé volontairement : les attributs
    // style={{}} React inline ne sont pas couvrables par nonce/hash (limitation
    // spec CSP3). Cible du durcissement = script-src uniquement.
    "style-src 'self' 'unsafe-inline' https://api.fontshare.com https://fonts.googleapis.com",
    "img-src 'self' data: https: blob:",
    "media-src 'self' data: https: blob:",
    "font-src 'self' data: https://cdn.fontshare.com",
    "connect-src 'self' https://*.supabase.co https://*.sentry.io https://cloud.langfuse.com wss://*.supabase.co https://*.upstash.io https://api.hypercli.com https://prod.spline.design https://*.spline.design https://unpkg.com",
    "frame-ancestors 'self' http://localhost:4200 http://localhost:4201 https://hearst-corporation.vercel.app",
    "base-uri 'self'",
    "form-action 'self'",
  ]
    .join("; ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

const PUBLIC_PATHS = [
  "/login",
  "/api/auth",
  "/api/health",
  "/api/webhooks",
  "/api/inngest", // Signé par INNGEST_SIGNING_KEY côté Inngest, pas d’auth user
  "/monitoring", // Tunnel route Sentry (cf. next.config.ts withSentryConfig)
];

/** Fichiers statiques publics — exemptés d’auth si le proxy est actif.
 * F-051: Restreint à /_next/* et /public/* pour éviter user-upload mis en statique.
 */
const STATIC_RE = /^\/(?:_next|public)\/|^\/favicon\.ico$/;

/* ── F-052: CSRF Origin check sur mutations (POST/PUT/DELETE/PATCH) ── */
const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "DELETE", "PATCH"]);

export function isCsrfSafe(req: NextRequest): boolean {
  // Requêtes GET, HEAD, OPTIONS : toujours safe (idempotentes)
  if (!STATE_CHANGING_METHODS.has(req.method)) return true;

  // Bypass pour routes signées (webhooks externes via INNGEST_SIGNING_KEY, etc.)
  const path = req.nextUrl.pathname;
  if (path.startsWith("/api/webhooks/") || path.startsWith("/api/inngest")) return true;

  // Vérifier Origin header (présent sur requêtes cross-origin depuis un navigateur)
  const origin = req.headers.get("origin");
  if (!origin) return false; // POST sans Origin → suspect (possible attaque CSRF)

  // Comparer avec NEXTAUTH_URL configuré
  const expected = process.env.NEXTAUTH_URL ?? "";
  if (!expected) return false; // Fallback : pas de config, refuse la requête

  try {
    const originUrl = new URL(origin);
    const expectedUrl = new URL(expected);
    // Comparer scheme + host + port
    return originUrl.origin === expectedUrl.origin;
  } catch {
    // Parse error sur Origin ou NEXTAUTH_URL → refuse
    return false;
  }
}

function isPublic(path: string): boolean {
  if (STATIC_RE.test(path)) return true;
  return PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}

/**
 * Décode le JWT NextAuth une seule fois par requête.
 * Retourne null si secret absent, JWT invalide, ou réseau error.
 *
 * Fix 2 : toutes les opérations du proxy (Arcjet userId, session check,
 * refreshToken check) réutilisent ce résultat pour éviter les N appels
 * getToken() par requête orchestrate (était 2-3 décodages → maintenant 1).
 */
async function resolveToken(req: NextRequest) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return null;
  return getToken({ req, secret }).catch(() => null);
}

function hasValidApiKey(req: NextRequest): boolean {
  const apiKey = process.env.HEARST_API_KEY;
  if (!apiKey) return false;

  const token =
    req.headers.get("x-api-key") ??
    req.headers.get("authorization")?.replace("Bearer ", "") ??
    null;

  if (!token) return false;

  // F-027 : comparaison en temps constant pour prévenir les timing attacks
  if (token.length !== apiKey.length) return false;
  return timingSafeEqual(Buffer.from(token), Buffer.from(apiKey));
}

const ARCJET_PROTECTED_PATHS = [
  "/api/orchestrate",
  "/api/v2/jobs",
  "/api/v2/missions",
  "/api/v2/assets/diff",
  "/api/v2/personas/ab-test",
  "/api/auth",
];

// Routes qui déclenchent 1 appel provider IA externe payant par requête.
// Quota strict via ajLlmJobs (20 req/min/user+IP). Les routes de polling
// (ex: /api/v2/jobs/[jobId]/status) restent sur `aj` (100 req/min/IP).
// Fix 1 : video-gen (~$0.50/run via Runway/HeyGen) ajouté au même quota.
export const ARCJET_LLM_JOB_PATHS = [
  "/api/v2/jobs/code-exec",
  "/api/v2/jobs/image-gen",
  "/api/v2/jobs/audio-gen",
  "/api/v2/jobs/document-parse",
  "/api/v2/jobs/video-gen",
  "/api/v2/assets/diff",
  "/api/v2/personas/ab-test",
];

// Fix F-098 : /api/agents/[id]/chat est un appel LLM direct, à protéger
// avec le même quota strict, mais SANS over-match sur /api/agents (CRUD
// list/get/update qui n'engage pas de LLM). Pattern regex sur segment [id].
const ARCJET_LLM_JOB_REGEX = /^\/api\/agents\/[^/]+\/(chat|run)$/;

function isArcjetProtected(path: string): boolean {
  // Inclut les routes LLM (notamment /api/agents/[id]/chat via regex)
  // qui ne figurent pas dans ARCJET_PROTECTED_PATHS mais doivent passer par applyArcjet.
  if (isLlmJobPath(path)) return true;
  return ARCJET_PROTECTED_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}

export function isLlmJobPath(path: string): boolean {
  if (ARCJET_LLM_JOB_REGEX.test(path)) return true;
  return ARCJET_LLM_JOB_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}

function arcjetDeniedResponse(decision: {
  reason: { isRateLimit(): boolean; isBot(): boolean; isShield(): boolean };
}): NextResponse {
  if (decision.reason.isRateLimit())
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  if (decision.reason.isBot()) return NextResponse.json({ error: "bot_detected" }, { status: 403 });
  if (decision.reason.isShield())
    return NextResponse.json({ error: "request_blocked" }, { status: 403 });
  return NextResponse.json({ error: "denied" }, { status: 403 });
}

/**
 * Extrait l'userId depuis un token JWT déjà décodé (non-async, réutilisable).
 * Évite un appel getToken() supplémentaire dans applyArcjet quand le token
 * a déjà été résolu par resolveToken() au début de proxy().
 */
function extractUserIdFromToken(
  token: Awaited<ReturnType<typeof resolveToken>>,
): string | undefined {
  const sub = token?.sub ?? (token?.userId as string | undefined);
  return typeof sub === "string" && sub.length > 0 ? sub : undefined;
}

async function applyArcjet(
  req: NextRequest,
  userId: string | undefined,
): Promise<NextResponse | null> {
  if (!isArcjetEnabled()) return null;
  const path = req.nextUrl.pathname;

  // P0-7 : userId passé en paramètre (extrait du JWT déjà décodé par proxy())
  // → aucun getToken() supplémentaire ici. Isole les users derrière corp NAT/VPN.
  // Le `aj` général (auth, missions) reste IP-only (moins critique).
  //
  // On appelle directement chaque instance (pas de variable partagée) pour
  // préserver le typage TypeScript des CharacteristicProps génériques Arcjet.
  if (path.startsWith("/api/orchestrate")) {
    if (!ajOrchestrate) return null;
    // CharacteristicProps<["ip.src","userId"]> rend userId obligatoire dans le type.
    // En pratique Arcjet accepte un userId absent → bascule sur ip.src.
    // Le cast évite l'erreur TS sans changer le comportement runtime.
    const props = { requested: 1, ...(userId && { userId }) } as Parameters<
      typeof ajOrchestrate.protect
    >[1];
    const decision = await ajOrchestrate.protect(req, props);
    return decision.isDenied() ? arcjetDeniedResponse(decision) : null;
  }

  if (isLlmJobPath(path)) {
    if (!ajLlmJobs) return null;
    const props = { requested: 1, ...(userId && { userId }) } as Parameters<
      typeof ajLlmJobs.protect
    >[1];
    const decision = await ajLlmJobs.protect(req, props);
    return decision.isDenied() ? arcjetDeniedResponse(decision) : null;
  }

  // Routes générales (auth, missions, polling) — bucket par IP uniquement.
  if (!aj) return null;
  const decision = await aj.protect(req, { requested: 1 });
  return decision.isDenied() ? arcjetDeniedResponse(decision) : null;
}

let _envChecked = false;

/** Applique un correlationId préétabli sur la response. */
function applyCorrelationId(response: NextResponse, correlationId: string): NextResponse {
  response.headers.set("x-correlation-id", correlationId);
  return response;
}

/**
 * F-078 : Pose le CSP nonce sur la response HTTP.
 * Doit être appelé sur TOUTES les responses retournées par proxy() pour que le
 * navigateur reçoive bien le header Content-Security-Policy.
 * (Les responses JSON/redirect ne servent pas de page HTML mais on les couvre
 * quand même — ça ne cause aucun problème et c'est plus sûr.)
 */
function applyCsp(response: NextResponse, csp: string): NextResponse {
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export async function proxy(req: NextRequest): Promise<NextResponse> {
  // F-078 : Générer le nonce CSP en tout premier — avant toute chose.
  // Web Crypto global (crypto.getRandomValues) : disponible Node 20+ ET Edge runtime.
  // btoa + String.fromCharCode produisent un nonce base64 opaque sans Buffer ni node:crypto.
  const nonceBytes = crypto.getRandomValues(new Uint8Array(16));
  const nonce = btoa(String.fromCharCode(...nonceBytes));
  const csp = buildCsp(nonce, isDev);

  // Cloner les headers de la requête pour y injecter le nonce et le CSP.
  // Next.js lit x-nonce pour nonce-er automatiquement ses scripts bootstrap.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  // Générer ou réutiliser le correlation-id — avant auth, avant Arcjet
  const correlationId = req.headers.get("x-correlation-id") ?? randomUUID();
  // F-022 : env validation lazily, une seule fois, sans crasher le boot.
  // env.server.ts est un side-effect module (pas d'exports) : on l'importe
  // dans un bloc try/catch pour ne pas crash le middleware si une var manque.
  if (!_envChecked) {
    _envChecked = true;
    try {
      // Dynamic import pour éviter le throw au module-load time sur Vercel Edge.
      // Path absolu via alias `@/` : proxy.ts est à la racine du repo, donc
      // un chemin relatif "../lib/env.server" sortait du projet et Turbopack
      // signalait un Module not found en boucle à chaque requête.
      await import("@/lib/env.server");
    } catch (e) {
      console.error("[proxy] env.server validation failed:", (e as Error).message);
      // Ne pas throw — laisse la requête continuer, le route handler retournera 500
      // si une env critique manque à l'exécution.
    }
  }

  const path = req.nextUrl.pathname;

  // Fix 2 : décodage JWT une seule fois par requête pour toutes les opérations
  // (Arcjet userId, session check, refreshToken check). Évite 2-3 appels
  // getToken() redondants sur les routes /api/orchestrate.
  // Skip pour les chemins statiques évidents et dev bypass (pas besoin).
  const jwtToken = !STATIC_RE.test(path) && !isDevBypassEnabled() ? await resolveToken(req) : null;
  const userId = extractUserIdFromToken(jwtToken);

  // Raccourci : construit une response "next()" qui propage les request headers
  // augmentés (x-nonce + CSP sur la requête) vers les Server Components.
  function nextWithNonce(): NextResponse {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // 1. Arcjet check sur les routes sensibles (avant auth pour bloquer
  // les attaques sans consommer de ressources auth).
  if (isArcjetProtected(path)) {
    const denied = await applyArcjet(req, userId);
    if (denied) return applyCsp(applyCorrelationId(denied, correlationId), csp);
  }

  if (isPublic(path)) {
    return applyCsp(applyCorrelationId(nextWithNonce(), correlationId), csp);
  }

  if (path.startsWith("/api/")) {
    // 2. Dev bypass check (F-NEW-P8-02) — d'abord, pour UX dev sans NEXTAUTH_URL.
    // isDevBypassEnabled() inclut un guard isProductionLike() qui refuse en prod.
    if (isDevBypassEnabled()) {
      console.log(`[Proxy] Dev bypass active — ${path}`);
      return applyCsp(applyCorrelationId(nextWithNonce(), correlationId), csp);
    }

    // 3. CSRF Origin check (F-052) — après dev bypass (dev local peut skip).
    if (!isCsrfSafe(req)) {
      console.warn(`[Proxy] CSRF origin mismatch — ${req.method} ${path}`);
      return applyCsp(
        applyCorrelationId(
          NextResponse.json({ error: "csrf_origin_mismatch" }, { status: 403 }),
          correlationId,
        ),
        csp,
      );
    }

    if (hasValidApiKey(req)) {
      return applyCsp(applyCorrelationId(nextWithNonce(), correlationId), csp);
    }

    // Réutilise jwtToken déjà décodé (was: hasSession(req) → getToken() again).
    if (jwtToken != null) {
      return applyCsp(applyCorrelationId(nextWithNonce(), correlationId), csp);
    }

    console.warn(`[Proxy] Unauthorized API access — ${path}`);
    return applyCsp(
      applyCorrelationId(
        NextResponse.json({ error: "unauthorized" }, { status: 401 }),
        correlationId,
      ),
      csp,
    );
  }

  if (jwtToken == null) {
    if (isDevBypassEnabled())
      return applyCsp(applyCorrelationId(nextWithNonce(), correlationId), csp);
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", path);
    console.log(`[Proxy] Redirecting unauthenticated user to login — ${path}`);
    return applyCsp(applyCorrelationId(NextResponse.redirect(loginUrl), correlationId), csp);
  }

  // Session présente mais refreshToken Google absent → token pas en base,
  // impossible d'appeler Gmail/Calendar/Drive. Forcer reconnexion Google.
  // Réutilise jwtToken (was: 3ème getToken() ici via getToken({ req, secret })).
  if (!isDevBypassEnabled()) {
    if (!jwtToken.refreshToken) {
      const signinUrl = new URL("/api/auth/signin", req.url);
      signinUrl.searchParams.set("callbackUrl", path);
      signinUrl.searchParams.set("reason", "token_missing");
      console.warn(`[Proxy] Session without refreshToken — forcing re-auth — ${path}`);
      return applyCsp(applyCorrelationId(NextResponse.redirect(signinUrl), correlationId), csp);
    }
  }

  const response = applyCsp(applyCorrelationId(nextWithNonce(), correlationId), csp);
  return applyHubHeaders(response, req);
}

/* ── Mode Hub (?hub=1) ──────────────────────────────────────────────────────
   Quand le produit est embarqué dans le hub Hearst, l'URL contient ?hub=1.
   On relâche les headers de sécurité qui bloquent l'embed :
   - Supprime X-Frame-Options
   - Remplace frame-ancestors 'none' par les origines du hub
   Cette section est appliquée en DERNIER sur chaque réponse.
*/

const HUB_ORIGINS = "'self' http://localhost:4200 https://hearst-corporation.vercel.app";

function applyHubHeaders(response: NextResponse, request: NextRequest): NextResponse {
  const isHub = request.nextUrl.searchParams.get("hub") === "1";
  if (!isHub) return response;

  // Relâcher frame-ancestors dans le CSP existant
  const existingCsp = response.headers.get("Content-Security-Policy") || "";
  if (existingCsp) {
    const relaxed = existingCsp.replace(
      /frame-ancestors\s+[^;]+/i,
      `frame-ancestors ${HUB_ORIGINS}`,
    );
    response.headers.set("Content-Security-Policy", relaxed);
  }
  // Supprimer X-Frame-Options pour permettre l'embed
  response.headers.delete("X-Frame-Options");

  return response;
}

/**
 * Matcher :
 * - Inclut /api (auth guard obligatoire sur les routes API — voir proxy() ci-dessus)
 * - Exclut /_next/static et /_next/image (assets statiques)
 * - Exclut /monitoring (tunnel Sentry via tunnelRoute, ne pas interrompre)
 * - Exclut favicon.ico et extensions de fichiers statiques courants
 * - Exclut les requêtes prefetch (next-router-prefetch / purpose: prefetch)
 */
export const config = {
  matcher: [
    {
      source:
        "/((?!_next/static|_next/image|monitoring|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
