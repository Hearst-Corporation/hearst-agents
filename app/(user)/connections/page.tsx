"use client";

import { ConnectionsHub } from "@/app/(user)/components/ConnectionsHub";

/**
 * Page /connections — Hub des connexions Composio + OAuth natifs.
 *
 * Restaurée après bascule shell visionOS (commit ef278511 avait
 * supprimé l'ancienne route avec (user-legacy)). Le composant
 * ConnectionsHub porte toute la logique (state, fetch, dedup
 * Composio/native, OAuth popup, postMessage listener) — la page
 * n'est qu'un wrapper de route.
 */
export default function ConnectionsPage() {
  return (
    <div className="flex h-screen w-screen flex-col bg-black text-white">
      <ConnectionsHub />
    </div>
  );
}
