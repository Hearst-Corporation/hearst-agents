import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // `output: "standalone"` est requis pour le build Docker (Dockerfile copie
  // .next/standalone) mais entre en conflit avec le packaging serverless
  // Vercel à l'étape "Deploying outputs..." (les 5 derniers deploys ont
  // échoué ainsi). On le conditionne sur l'absence de VERCEL=1 (set auto
  // par Vercel au build).
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
  // Pin la racine workspace pour que Turbopack n'aille pas la déduire
  // depuis un package.json plus haut dans l'arbo (ex. ~/package.json).
  turbopack: {
    root: import.meta.dirname,
  },
  // Exclusions du file-tracing Next.js — Vercel package chaque function avec
  // les fichiers tracés. Sans exclusions, le bundle a explosé à 590 MB (cap
  // Vercel: 250 MB unzipped) à cause d'Electron desktop runtime + assets
  // runtime + libs client-only tracées server-side.
  outputFileTracingExcludes: {
    "*": [
      // Electron desktop runtime (~342 MB binaire macOS) — devDependency,
      // jamais exécuté serverless. Match agressif sur tous les fichiers.
      "**/node_modules/electron/**",
      "**/node_modules/electron-*/**",
      "**/node_modules/@electron/**",
      // Assets runtime user (audio, screenshots, PDFs locaux dev).
      // Patterns non-ambigus : pas de **/dist/** qui matcherait node_modules/*/dist.
      ".runtime-assets/**",
      "data/**",
      "build/**",
      // 3D / WebGL — client-only, dynamic imports côté browser
      "**/node_modules/three/**",
      "**/node_modules/@splinetool/**",
      "**/node_modules/3d-force-graph/**",
      "**/node_modules/cytoscape/**",
      "**/node_modules/cytoscape-*/**",
      "**/node_modules/react-cytoscapejs/**",
      // Sourcemaps Next dev runtime
      "**/node_modules/next/dist/compiled/next-server/*.dev.js.map",
      // Tests
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/__tests__/**",
    ],
  },
  // Marque comme externe pour que le bundler ne tente pas de les inliner
  // dans le code serverless (ils seront require() à runtime depuis node_modules).
  serverExternalPackages: [
    "electron",
    "three",
    "cytoscape",
    "3d-force-graph",
    "@splinetool/runtime",
  ],
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
