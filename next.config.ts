import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

/* ── F-078: Sécurité HTTP headers (HSTS, X-Frame, Permissions-Policy) ──
   Embed autorisé depuis le hub Hearst Cockpit (localhost:4200/4201 + Vercel).
   Pas de X-Frame-Options : il bloque toute embed cross-origin et ne supporte
   pas de whitelist — le CSP frame-ancestors le remplace.
   NOTE : le Content-Security-Policy (avec frame-ancestors) est désormais géré
   dans proxy.ts via nonce dynamique par requête (suppression 'unsafe-inline'
   sur script-src, F-078). Les autres headers de sécurité restent ici. */
function buildSecurityHeaders(): Array<{ key: string; value: string }> {
  return [
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
    // X-Frame-Options délibérément absent : l'embed hub est géré via
    // frame-ancestors dans le CSP dynamique (proxy.ts). X-Frame-Options ne
    // supporte pas de whitelist et bloquerait l'embed cross-origin.
  ];
}

const nextConfig: NextConfig = {
  transpilePackages: ["@hearst/cockpit-shell", "@hearst/hub-sdk"],
  devIndicators: false,
  // standalone requis pour Vercel — copie tous les fichiers runtime Next.js
  // (dont node-environment.js) dans le bundle. La taille était le problème
  // (590 MB → Electron) — désormais strippé via installCommand dans vercel.json.
  output: "standalone" as const,
  // React Compiler 19 — mémoïsation automatique (+25% perf, -40% useMemo/useCallback manuels).
  // Requiert babel-plugin-react-compiler en devDep. Composants violant les Rules of React
  // peuvent être exclus via reactCompiler: { compilationMode: 'annotation' } + directive "use memo".
  reactCompiler: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "*.supabase.in" },
      { protocol: "https", hostname: "gravatar.com" },
      { protocol: "https", hostname: "*.gravatar.com" },
      { protocol: "https", hostname: "*.r2.cloudflarestorage.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
    ],
  },
  // Pin la racine workspace pour que Turbopack n'aille pas la déduire
  // depuis un package.json plus haut dans l'arbo (ex. ~/package.json).
  turbopack: {
    root: import.meta.dirname,
  },
  experimental: {
    optimizePackageImports: [
      "framer-motion",
      "zustand",
      "@supabase/supabase-js",
      "zod",
      "lucide-react",
    ],
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
