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
 * Environment validation is triggered by importing lib/env.server.ts
 */

import "@/lib/env.server";
import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { aj, ajOrchestrate, ajLlmJobs, isArcjetEnabled } from "@/lib/security/arcjet";
import { isDevBypassEnabled } from "@/lib/platform/auth/dev-bypass";

const PUBLIC_PATHS = [
  "/login",
  "/api/auth",
  "/api/health",
  "/api/webhooks",
  "/api/inngest", // Signé par INNGEST_SIGNING_KEY côté Inngest, pas d'auth user
  "/monitoring", // Tunnel route Sentry (cf. next.config.ts withSentryConfig)
];

/** Fichiers statiques publics (dont modèles 3D) — exemptés d’auth si le proxy est actif. */
const STATIC_RE =
  /^\/(?:_next|favicon\.ico|.*\.(?:svg|png|jpg|ico|webp|woff2?|css|js|glb|gltf))$/;

function isPublic(path: string): boolean {
  if (STATIC_RE.test(path)) return true;
  return PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}

// F-026 : valide la signature JWT du cookie, ne se contente pas de sa présence
async function hasSession(req: NextRequest): Promise<boolean> {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return false;
  const token = await getToken({ req, secret });
  return token != null && typeof token === "object";
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
// Quota strict via ajLlmJobs (20 req/min/IP). Les routes de polling
// (ex: /api/v2/jobs/[jobId]/status) restent sur `aj` (100 req/min).
const ARCJET_LLM_JOB_PATHS = [
  "/api/v2/jobs/code-exec",
  "/api/v2/jobs/image-gen",
  "/api/v2/jobs/audio-gen",
  "/api/v2/jobs/document-parse",
  "/api/v2/assets/diff",
  "/api/v2/personas/ab-test",
];

function isArcjetProtected(path: string): boolean {
  return ARCJET_PROTECTED_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}

function isLlmJobPath(path: string): boolean {
  return ARCJET_LLM_JOB_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}

async function applyArcjet(req: NextRequest): Promise<NextResponse | null> {
  if (!isArcjetEnabled()) return null;
  const path = req.nextUrl.pathname;
  // Routing par coût :
  //  - orchestrate (chat LLM streaming)        → ajOrchestrate (10 req/min)
  //  - jobs IA externes + diff/ab-test         → ajLlmJobs    (20 req/min)
  //  - reste (auth, missions, polling status)  → aj           (100 req/min)
  let instance: typeof aj;
  if (path.startsWith("/api/orchestrate")) {
    instance = ajOrchestrate;
  } else if (isLlmJobPath(path)) {
    instance = ajLlmJobs;
  } else {
    instance = aj;
  }
  if (!instance) return null;
  const decision = await instance.protect(req, { requested: 1 });
  if (decision.isDenied()) {
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
  return null;
}

export async function proxy(req: NextRequest): Promise<NextResponse> {
  const path = req.nextUrl.pathname;

  // 1. Arcjet check sur les routes sensibles (avant auth pour bloquer
  // les attaques sans consommer de ressources auth).
  if (isArcjetProtected(path)) {
    const denied = await applyArcjet(req);
    if (denied) return denied;
  }

  if (isPublic(path)) {
    return NextResponse.next();
  }

  if (path.startsWith("/api/")) {
    if (isDevBypass()) {
      console.log(`[Proxy] Dev bypass active — ${path}`);
      return NextResponse.next();
    }

    if (hasValidApiKey(req)) {
      return NextResponse.next();
    }

    if (await hasSession(req)) {
      return NextResponse.next();
    }

    console.warn(`[Proxy] Unauthorized API access — ${path}`);
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!(await hasSession(req))) {
    if (isDevBypass()) return NextResponse.next();
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", path);
    console.log(`[Proxy] Redirecting unauthenticated user to login — ${path}`);
    return NextResponse.redirect(loginUrl);
  }

  // Session présente mais refreshToken Google absent → token pas en base,
  // impossible d'appeler Gmail/Calendar/Drive. Forcer reconnexion Google.
  if (!isDevBypass()) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.refreshToken) {
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
