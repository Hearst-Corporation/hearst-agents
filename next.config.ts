import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

/* ── F-078: Sécurité HTTP headers (CSP, HSTS, X-Frame, Permissions-Policy) ── */
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.sentry.io https://cloud.langfuse.com https://unpkg.com",
      "worker-src 'self' blob:",
      "child-src 'self' blob:",
      "style-src 'self' 'unsafe-inline' https://api.fontshare.com https://fonts.googleapis.com",
      "img-src 'self' data: https: blob:",
      "media-src 'self' data: https: blob:",
      "font-src 'self' data: https://cdn.fontshare.com",
      "connect-src 'self' https://*.supabase.co https://*.sentry.io https://cloud.langfuse.com wss://*.supabase.co https://*.upstash.io https://prod.spline.design https://*.spline.design https://unpkg.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
    // Note: preload déploié uniquement après validation manuelle du domaine sur
    // https://hstspreload.org/. C'est irréversible pour 6 mois minimum.
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(self), geolocation=(), interest-cohort=()",
  },
];

const nextConfig: NextConfig = {
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
        headers: securityHeaders,
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
