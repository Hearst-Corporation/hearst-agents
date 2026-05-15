"use client";

import { SessionProvider } from "next-auth/react";
import { useGlobalHotkeys } from "@/app/hooks/use-global-hotkeys";

/**
 * Layout du shell visionOS (route group `(user-x)`, port WIP).
 *
 * Hérite du root layout (`app/layout.tsx`) qui déclare déjà `<html>` et
 * `<body>`. Ce layout enfant n'ajoute QUE :
 *   - SessionProvider NextAuth (le shell consomme `session.user`)
 *   - useGlobalHotkeys (⌘K, ⌘1..9, ⌘0, ⌘⇧V, ⌘⇧F, ⌘B, ⌘G, ⌘⌫, ESC)
 *   - Wrapper plein écran sombre #050505 pour le canvas visionOS
 *
 * IMPORTANT : pas de re-déclaration `<html>` ou `<body>` (anti-pattern
 * Next.js — un seul autorisé, dans le root). Les overlays globaux
 * (Commandeur, VideoQuickLaunch, VoicePulse, FocusBadge) seront montés
 * en P7 quand le shell sera complet ; en P1 on reste minimaliste.
 */
export default function UserXLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  useGlobalHotkeys();
  return (
    <SessionProvider>
      <div className="h-screen w-full overflow-hidden bg-[#050505] text-white antialiased">
        {children}
      </div>
    </SessionProvider>
  );
}
