"use client";

/**
 * PulseBar — Header fusionné minimaliste (post-refonte 2026-04-29).
 *
 * Inspiré Linear/Cursor/Vercel : ≤ 56px, drop des status idle/system, Cmd+K
 * central, indicators conditionnels uniquement quand pertinents.
 *
 * Trois zones :
 *   gauche  — hamburger mobile + logo H (clic → cockpit)
 *   centre  — Cmd+K trigger (placeholder rotatif, ouvre Commandeur)
 *   droite  — En cours / Voix + connections meter + cloche
 *
 * Pivot 2026-05-03 : retrait du cost meter (mention coût/budget bannie
 * de l'UI cockpit — l'utilisateur ne veut pas de friction financière
 * dans le flow de travail).
 */

import { useEffect, useState } from "react";
import { useRuntimeStore } from "@/stores/runtime";
import { useStageStore } from "@/stores/stage";
import { useNavigationStore } from "@/stores/navigation";
import { GhostIconMenu } from "./ghost-icons";
import { NotificationBell } from "./NotificationBell";

interface ConnectionsMeta {
  connected: number;
  total: number;
}

export function PulseBar() {
  const coreState = useRuntimeStore((s) => s.coreState);
  const mode = useStageStore((s) => s.current.mode);
  const setCommandeurOpen = useStageStore((s) => s.setCommandeurOpen);

  const toggleLeftDrawer = useNavigationStore((s) => s.toggleLeftDrawer);

  const isVoiceActive = mode === "voice";
  const isRunning =
    coreState === "connecting" ||
    coreState === "streaming" ||
    coreState === "processing" ||
    coreState === "awaiting_approval" ||
    coreState === "awaiting_clarification";

  // ── Connections meter — feedback ambient sur l'état des apps ──
  // Source : /api/v2/user/connections (canonical, retourne meta { connected, total }).
  // Refresh 60s pour capter les nouvelles connexions OAuth sans saturer.
  const [connections, setConnections] = useState<ConnectionsMeta | null>(null);
  useEffect(() => {
    let cancelled = false;
    async function refreshConnections() {
      try {
        const r = await fetch("/api/v2/user/connections", { cache: "no-store" });
        if (!r.ok) return;
        const data = (await r.json()) as { meta?: ConnectionsMeta };
        if (!cancelled && data?.meta) {
          setConnections({ connected: data.meta.connected, total: data.meta.total });
        }
      } catch {
        // Fail-soft : on garde l'ancienne valeur, jamais de crash.
      }
    }
    refreshConnections();
    const interval = setInterval(refreshConnections, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <div
      className="relative flex items-center px-4 shrink-0 z-30"
      style={{
        height: "var(--height-pulsebar)",
        background: "var(--rail)",
        gap: "var(--space-3)",
        paddingLeft: "calc(var(--space-4) + var(--width-electron-titlebar))",
        boxShadow: "var(--shadow-divider-bottom-subtle)",
      }}
    >
      {/* Gauche : hamburger mobile uniquement (branding vit dans la sidebar) */}
      <div className="flex items-center" style={{ gap: "var(--space-2)" }}>
        <button
          type="button"
          onClick={toggleLeftDrawer}
          className="md:hidden w-7 h-7 flex items-center justify-center text-text-faint hover:text-(--accent-teal) transition-colors shrink-0"
          aria-label="Ouvrir les conversations"
        >
          <GhostIconMenu className="w-4 h-4" />
        </button>
      </div>

      {/* Centre : Cmd+K trigger plein-largeur — pill glass.
       *  Action principale du Cockpit → traité comme tel : padding généreux,
       *  placeholder en text-soft (vs faint) pour first-read clair. La pill
       *  reste contenue dans var(--height-pulsebar) (I-1 PulseBar). */}
      <button
        type="button"
        onClick={() => setCommandeurOpen(true)}
        className="touch-cmdk-pill flex-1 min-w-0 max-w-xl mx-auto flex items-center justify-between"
        style={{
          padding: "var(--space-2) var(--space-4)",
          borderRadius: "var(--radius-md)",
        }}
        title="Ouvrir le Commandeur"
      >
        <span className="t-11 truncate text-text-soft">Demande à Hearst…</span>
        <span
          className="t-9 font-mono shrink-0 ml-3"
          style={{
            color: "var(--text-muted)",
            padding: "2px var(--space-1)",
            border: "1px solid var(--border-soft)",
            borderRadius: "var(--radius-xs)",
            letterSpacing: "0.04em",
          }}
        >
          ⌘K
        </span>
      </button>

      {/* Droite : run/voice/credits/profile (tout conditionnel).
         Pivot UI 2026-05-01 : on retire les labels mono caps tracking-marquee
         (RUN_ACTIVE / VOICE_ON / CREDITS) qui criaient comme des états critiques
         alors qu'ils étaient juste informationnels. Voix éditoriale calme +
         dot accent-teal pour l'état système. */}
      <div className="flex items-center shrink-0" style={{ gap: "var(--space-4)" }}>
        {isRunning && (
          <div className="flex items-center" style={{ gap: "var(--space-2)" }}>
            <span
              className="rounded-pill bg-(--accent-teal) animate-pulse halo-dot"
              style={{ width: "var(--space-2)", height: "var(--space-2)" }}
              aria-hidden
            />
            <span className="t-11 font-light text-(--accent-teal)">En cours</span>
          </div>
        )}

        {isVoiceActive && (
          <div className="flex items-center" style={{ gap: "var(--space-2)" }}>
            <span
              className="rounded-pill bg-(--accent-teal) halo-cyan-sm animate-pulse"
              style={{ width: "var(--space-2)", height: "var(--space-2)" }}
              aria-hidden
            />
            <span className="t-11 font-light text-(--accent-teal)">Voix</span>
          </div>
        )}

        {connections && (
          <a
            href="/apps"
            className="hidden md:flex items-center hover:opacity-80 transition-opacity"
            style={{ gap: "var(--space-2)" }}
            title={`${connections.connected}/${connections.total} services connectés — gérer dans /apps`}
            data-testid="connections-meter"
          >
            <span
              className="rounded-pill bg-(--accent-teal)"
              style={{ width: "var(--space-2)", height: "var(--space-2)" }}
              aria-hidden
            />
            <span className="t-11 font-mono tabular-nums text-text-soft">
              {connections.connected}
            </span>
            <span className="t-11 font-light text-text-faint">
              / {connections.total} services
            </span>
          </a>
        )}

        <NotificationBell />
      </div>
    </div>
  );
}
