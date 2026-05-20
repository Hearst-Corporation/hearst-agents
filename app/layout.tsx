// lint-visual-disable-file
// Couleur theme hex requise par la spec PWA (Web App Manifest /
// meta theme-color). Pas un magic number CSS — opt-out légitime.
import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "./globals.css";
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
  themeColor: "#1A050B" /* = --ct-bg-deep */,
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const themeCookie = (await cookies()).get("theme")?.value ?? "default";
  return (
    <html lang="fr" className="dark h-full antialiased" data-theme={themeCookie}>
      <head>
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link rel="preconnect" href="https://cdn.fontshare.com" crossOrigin="anonymous" />
        <link
          href="https://api.fontshare.com/v2/css?f[]=satoshi-variable@900,700,500,400,300&display=swap"
          rel="stylesheet"
        />
        {/*
         * Inter+Tight retiré 2026-05-15 — F-045/F-115 : la CSP `style-src` ne
         * whitelist pas `fonts.googleapis.com` (seul fontshare l'est) et la
         * police canonique de l'app est Satoshi Variable (`--font-satoshi`).
         * Inter Tight n'est référencé que par le thème "robotflow" qui charge
         * ses propres tokens.css — pas besoin d'un <link> global ici.
         */}
      </head>
      <body className="h-full text-text overflow-hidden">
        <div className="ghost-bg" />
        <ThemeHydrator initial={themeCookie} />
        {children}
        <NoiseLayer />
        <ToastHost />
      </body>
    </html>
  );
}
