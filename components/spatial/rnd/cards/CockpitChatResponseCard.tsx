"use client";

import { useMemo } from "react";
import type { SpatialPanelCardProps } from "@/lib/spatial/panel-registry";
import { useNavigationStore } from "@/stores/navigation";
import { CockpitCardShell } from "./CockpitCardShell";

/**
 * Card ChatResponse — affiche le dernier message assistant du thread actif.
 *
 * Apparaît dès qu'un text_delta arrive (gestion dans subscriber au niveau host).
 * Auto-fade géré par le TTL du store (15s sans nouveau delta).
 */
export function CockpitChatResponseCard(_props: SpatialPanelCardProps) {
  const activeThreadId = useNavigationStore((s) => s.activeThreadId);
  const messages = useNavigationStore((s) =>
    activeThreadId ? s.messages[activeThreadId] : undefined,
  );

  const lastAssistant = useMemo(() => {
    if (!messages) return null;
    const reversed = [...messages].reverse();
    return reversed.find((m) => m.role === "assistant") ?? null;
  }, [messages]);

  return (
    <CockpitCardShell>
      <div className="flex h-full flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-spatial-xs font-semibold uppercase tracking-[0.2em] text-white/45">
            Réponse
          </span>
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{
              background: "rgba(0,229,204,0.85)",
              boxShadow: "0 0 8px rgba(0,229,204,0.6)",
              animation: "spatial-mission-pulse 2.4s ease-in-out infinite",
            }}
          />
        </div>

        {lastAssistant && lastAssistant.content.trim().length > 0 ? (
          <p className="text-spatial-base font-light leading-[1.65] text-white/85 line-clamp-[12]">
            {lastAssistant.content}
          </p>
        ) : (
          <p className="text-spatial-base font-light text-white/40">Hearst rédige…</p>
        )}
      </div>
    </CockpitCardShell>
  );
}
