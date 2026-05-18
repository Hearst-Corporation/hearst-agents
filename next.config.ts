import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * Détecte si la requête vient du hub Hearst (embarqué en webview/iframe).
 * Le hub injecte ?hub=1 dans l'URL du produit.
 */
function isHubRequest(source?: string): boolean {
  if (!source) return false;
  try {
    const u = new URL(source);
    return u.searchParams.get("hub") === "1";
  } catch {
    return false;
  }
}

/* ── F-078: Sécurité HTTP headers (CSP, HSTS, X-Frame, Permissions-Policy) ──
   En développement local, on relâche frame-ancestors et X-Frame-Options
   pour permettre l'embed dans le hub Hearst (localhost:4200).
   En production, les headers restent stricts (frame-ancestors 'none'). */
function buildSecurityHeaders(): Array<{ key: string; value: string }> {
  // En dev local, le hub et les produits tournent sur localhost — on autorise
  // l'embed pour faciliter le développement. En prod, le hub est sur Vercel
  // et les produits doivent explicitement accepter l'embed via leur config.
  const allowEmbed = isDev;

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' ${isDev ? "'unsafe-eval' 'wasm-unsafe-eval'" : ""} https://*.sentry.io https://cloud.langfuse.com https://unpkg.com`,
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    "style-src 'self' 'unsafe-inline' https://api.fontshare.com https://fonts.googleapis.com",
    "img-src 'self' data: https: blob:",
    "media-src 'self' data: https: blob:",
    "font-src 'self' data: https://cdn.fontshare.com",
    "connect-src 'self' https://*.supabase.co https://*.sentry.io https://cloud.langfuse.com wss://*.supabase.co https://*.upstash.io https://api.hypercli.com https://prod.spline.design https://*.spline.design https://unpkg.com",
    allowEmbed
      ? "frame-ancestors 'self' http://localhost:4200 https://hearst-corporation.vercel.app"
      : "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");

  const headers: Array<{ key: string; value: string }> = [
    { key: "Content-Security-Policy", value: csp },
    {
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains",
    },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(self), geolocation=(), interest-cohort=()",
    },
  ];

  if (!allowEmbed) {
    headers.push({ key: "X-Frame-Options", value: "DENY" });
  }

  return headers;
}

const nextConfig: NextConfig = {
  transpilePackages: ["@hearst/cockpit-shell"],
  // standalone requis pour Vercel — copie tous les fichiers runtime Next.js
  // (dont node-environment.js) dans le bundle. La taille était le problème
  // (590 MB → Electron) — désormais strippé via installCommand dans vercel.json.
  output: "standalone" as const,
  // React Compiler 19 — mémoïsation automatique (+25% perf, -40% useMemo/useCallback manuels).
  // Requiert babel-plugin-react-compiler en devDep. Composants violant les Rules of React
  // peuvent être exclus via reactCompiler: { compilationMode: 'annotation' } + directive "use memo".
  reactCompiler: true,
  // Pin la racine workspace pour que Turbopack n'aille pas la déduire
  // depuis un package.json plus haut dans l'arbo (ex. ~/package.json).
  turbopack: {
    root: import.meta.dirname,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: buildSecurityHeaders(),
      },
    ];
  },
};

// Sentry config — wrapper pour upload des sourcemaps + tunneling.
// Active uniquement si SENTRY_AUTH_TOKEN + SENTRY_PROJECT + SENTRY_ORG présents.
// Sans ça, le DSN runtime reste actif (errors capturées) mais pas de release
// tracking ni de sourcemaps upload.
const sentryProject = process.env.SENTRY_PROJECT;
const sentryOrg = process.env.SENTRY_ORG;

export default process.env.SENTRY_AUTH_TOKEN && sentryProject && sentryOrg
  ? withSentryConfig(nextConfig, {
      org: sentryOrg,
      project: sentryProject,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      // Silencieux en build local, verbeux en CI
      silent: !process.env.CI,
      // Upload une plus grande surface de fichiers client pour de meilleures stack traces
      widenClientFileUpload: true,
      // Upload sourcemaps mais ne les serve pas publiquement
      sourcemaps: {
        deleteSourcemapsAfterUpload: true,
      },
      // Tunnel les requêtes Sentry via /monitoring (contourne adblockers)
      tunnelRoute: "/monitoring",
    })
  : nextConfig;
