// lint-visual-disable-file
// Couleur theme hex requise par la spec PWA (Web App Manifest /
// meta theme-color). Pas un magic number CSS — opt-out légitime.
import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "./globals.css";
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
        <link
          href="https://api.fontshare.com/v2/css?f[]=satoshi-variable@900,700,500,400,300&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="h-full text-text overflow-hidden">
        <div className="ghost-bg" />
        <ThemeHydrator initial={themeCookie} />
        {children}
        <NoiseLayer />
      </body>
    </html>
  );
}
