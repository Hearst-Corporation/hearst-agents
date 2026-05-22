/**
 * Layout de la branche user — Server Component (P0-11).
 *
 * Depuis P0-11, ce layout n'est plus `"use client"` : tout le runtime
 * client-only (SessionProvider, CockpitShell, hooks globaux, overlays) est
 * isolé dans <ClientProviders>. Cela permet aux pages enfants d'être des
 * Server Components (ex: `page.tsx`, `cockpit-x/page.tsx`) sans forcer
 * l'hydratation client de toute la branche depuis le layout.
 */

import { ClientProviders } from "@/app/(user)/components/ClientProviders";

export default function UserXLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <ClientProviders>{children}</ClientProviders>;
}
