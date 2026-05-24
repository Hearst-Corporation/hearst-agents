// lint-visual-disable-file
// Couleur theme hex requise par la spec PWA (Web App Manifest /
// meta theme-color). Pas un magic number CSS — opt-out légitime.
import type { Metadata, Viewport } from "next";
import { cookies, headers } from "next/headers";
import "./globals.css";
import { NONCE_HEADER } from "@/lib/security/csp-nonce";
import { ToastHost } from "./(user)/components/ui/ToastHost";
import { NoiseLayer } from "./components/system/NoiseLayer";
import { ThemeHydrator } from "./components/system/ThemeHydrator";

export const metadata: Metadata = {
  title: "Hearst",
  description: "Hearst — votre assistant intelligent",
  applicationName: "Hearst OS",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Hearst",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#16161B",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const themeCookie = (await cookies()).get("theme")?.value ?? "default";
  // Lit le nonce injecté par proxy.ts (middleware) pour les Server Components.
  // Propagé via NONCE_HEADER (x-csp-nonce) dans les headers de requête.
  const nonce = (await headers()).get(NONCE_HEADER) ?? "";
  return (
    <html
      lang="fr"
      className="dark h-full antialiased"
      data-theme={themeCookie}
      data-product="helm"
    >
      <head>
        {/* Nonce CSP — lisible côté client par les scripts noncés (ex: Sentry, analytics). */}
        {nonce && <meta name="csp-nonce" content={nonce} />}
        {/* Preconnect fontshare CDN — réduit la latence de connexion */}
        <link rel="preconnect" href="https://api.fontshare.com" crossOrigin="anonymous" />
        {/*
         * Satoshi Variable — chargement direct (display=swap gère le FOIT).
         * React 19 SSR ignore onLoad-string → le pattern media=print+onLoad
         * ne fonctionnait plus. Un <link rel="stylesheet"> simple est fiable
         * en SSR et en client-navigation.
         * NOTE : pour passer en self-host complet (next/font/local), fournir les
         * fichiers .woff2 Satoshi (absents du repo) et supprimer ce bloc.
         */}
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=satoshi-variable@900,700,500,400,300&display=swap"
        />
        {/*
         * Inter+Tight retiré 2026-05-15 — F-045/F-115 : la CSP `style-src` ne
         * whitelist pas `fonts.googleapis.com` (seul fontshare l'est) et la
         * police canonique de l'app est Satoshi Variable (`--font-satoshi`).
         * Inter Tight n'est référencé que par le thème "robotflow" qui charge
         * ses propres tokens.css — pas besoin d'un <link> global ici.
         */}
      </head>
      <body className="h-full text-text">
        <div className="ghost-bg" />
        <ThemeHydrator initial={themeCookie} />
        {children}
        <NoiseLayer />
        <ToastHost />
      </body>
    </html>
  );
}
