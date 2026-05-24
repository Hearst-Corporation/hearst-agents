/**
 * CSP Nonce helper — F-078-nonce
 *
 * Génère un nonce cryptographiquement aléatoire (16 bytes, base64) par requête.
 * Le nonce est propagé via le header `x-csp-nonce` dans les request headers,
 * transmis aux Server Components via NextResponse.next({ request: { headers } }).
 * Le middleware construit la CSP dynamique avec `'nonce-${nonce}' 'strict-dynamic'`.
 */

import { randomBytes } from "node:crypto";

/** Génère un nonce de 16 bytes en base64 (valide comme valeur de nonce CSP). */
export function generateNonce(): string {
  return randomBytes(16).toString("base64");
}

/**
 * Nom du header HTTP interne utilisé pour propager le nonce du middleware
 * vers les Server Components (via `headers()` de next/headers).
 * Injecté dans les REQUEST headers via NextResponse.next({ request: { headers } }).
 */
export const NONCE_HEADER = "x-csp-nonce";

/**
 * Construit la valeur complète de la directive Content-Security-Policy
 * avec le nonce courant. Utilisé dans proxy.ts (middleware) pour générer
 * une CSP dynamique par requête.
 *
 * `'strict-dynamic'` permet aux scripts noncés de charger d'autres scripts
 * (trust propagation) — les whitelist https://... sont ignorées par strict-dynamic
 * dans les navigateurs modernes qui le supportent, mais gardées pour fallback.
 */
export function buildCsp(nonce: string, isDev: boolean): string {
  const directives = [
    "default-src 'self'",
    [
      "script-src",
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      // Fallback pour navigateurs sans strict-dynamic (IE11, vieux Safari)
      "'unsafe-inline'",
      // En dev uniquement : eval pour React Fast Refresh / Webpack HMR
      isDev ? "'unsafe-eval' 'wasm-unsafe-eval'" : "",
      // Whitelist de fallback (ignorée par strict-dynamic dans navigateurs modernes)
      "https://*.sentry.io",
      "https://cloud.langfuse.com",
      "https://unpkg.com",
    ]
      .filter(Boolean)
      .join(" "),
    [
      "style-src",
      "'self'",
      `'nonce-${nonce}'`,
      // Fallback : 'unsafe-inline' requis pour styles SSR Next.js + Tailwind
      "'unsafe-inline'",
      "https://api.fontshare.com",
      "https://fonts.googleapis.com",
    ].join(" "),
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    "img-src 'self' data: https: blob:",
    "media-src 'self' data: https: blob:",
    "font-src 'self' data: https://cdn.fontshare.com",
    [
      "connect-src",
      "'self'",
      "https://*.supabase.co",
      "https://*.sentry.io",
      "https://cloud.langfuse.com",
      "wss://*.supabase.co",
      "https://*.upstash.io",
      "https://api.hypercli.com",
      "https://prod.spline.design",
      "https://*.spline.design",
      "https://unpkg.com",
    ].join(" "),
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ];

  return directives.join("; ");
}
