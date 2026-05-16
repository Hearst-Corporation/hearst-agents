/**
 * Next.js Proxy — Global Auth Guard + Arcjet Edge Protection
 *
 * Canonical request guard for Next.js 16 / Turbopack.
 * It runs before route handlers and enforces:
 * 1. Arcjet protection (rate limit + bot detection + shield) sur routes critiques
 * 2. Authentication (session or API key)
 * 3. Public path exemptions
 * 4. Explicit dev bypass only
 *
 * F-022 : env.server validation est effectuée en lazy import (dans proxy())
 * plutôt qu'à l'import statique. Un throw au boot ne crash plus le middleware
 * Vercel Edge — il produit une 500 loguée à la première requête.
 */

import { timingSafeEqual } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { isDevBypassEnabled } from "@/lib/platform/auth/dev-bypass";
import { aj, ajLlmJobs, ajOrchestrate, isArcjetEnabled } from "@/lib/security/arcjet";

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

function isDevBypass(): boolean {
  return isDevBypassEnabled();
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
// Fix F-098 : /api/agents/[id]/chat est un appel LLM direct, même sans smart-routing.
export const ARCJET_LLM_JOB_PATHS = [
  "/api/agents",
  "/api/v2/jobs/code-exec",
  "/api/v2/jobs/image-gen",
  "/api/v2/jobs/audio-gen",
  "/api/v2/jobs/document-parse",
  "/api/v2/jobs/video-gen",
  "/api/v2/assets/diff",
  "/api/v2/personas/ab-test",
];

function isArcjetProtected(path: string): boolean {
  return ARCJET_PROTECTED_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}

function isLlmJobPath(path: string): boolean {
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

export async function proxy(req: NextRequest): Promise<NextResponse> {
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
  const jwtToken = !STATIC_RE.test(path) && !isDevBypass() ? await resolveToken(req) : null;
  const userId = extractUserIdFromToken(jwtToken);

  // 1. Arcjet check sur les routes sensibles (avant auth pour bloquer
  // les attaques sans consommer de ressources auth).
  if (isArcjetProtected(path)) {
    const denied = await applyArcjet(req, userId);
    if (denied) return denied;
  }

  if (isPublic(path)) {
    return NextResponse.next();
  }

  if (path.startsWith("/api/")) {
    // 2. Dev bypass check (F-NEW-P8-02) — d'abord, pour UX dev sans NEXTAUTH_URL.
    // isDevBypass() inclut un guard isProductionLike() qui refuse en prod.
    if (isDevBypass()) {
      console.log(`[Proxy] Dev bypass active — ${path}`);
      return NextResponse.next();
    }

    // 3. CSRF Origin check (F-052) — après dev bypass (dev local peut skip).
    if (!isCsrfSafe(req)) {
      console.warn(`[Proxy] CSRF origin mismatch — ${req.method} ${path}`);
      return NextResponse.json({ error: "csrf_origin_mismatch" }, { status: 403 });
    }

    if (hasValidApiKey(req)) {
      return NextResponse.next();
    }

    // Réutilise jwtToken déjà décodé (was: hasSession(req) → getToken() again).
    if (jwtToken != null) {
      return NextResponse.next();
    }

    console.warn(`[Proxy] Unauthorized API access — ${path}`);
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (jwtToken == null) {
    if (isDevBypass()) return NextResponse.next();
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", path);
    console.log(`[Proxy] Redirecting unauthenticated user to login — ${path}`);
    return NextResponse.redirect(loginUrl);
  }

  // Session présente mais refreshToken Google absent → token pas en base,
  // impossible d'appeler Gmail/Calendar/Drive. Forcer reconnexion Google.
  // Réutilise jwtToken (was: 3ème getToken() ici via getToken({ req, secret })).
  if (!isDevBypass()) {
    if (!jwtToken.refreshToken) {
      const signinUrl = new URL("/api/auth/signin", req.url);
      signinUrl.searchParams.set("callbackUrl", path);
      signinUrl.searchParams.set("reason", "token_missing");
      console.warn(`[Proxy] Session without refreshToken — forcing re-auth — ${path}`);
      return NextResponse.redirect(signinUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
};
