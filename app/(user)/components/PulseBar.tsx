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

import { useEffect, useMemo, useState } from "react";
import { useFocusMode } from "@/stores/focus-mode";
import { useNavigationStore } from "@/stores/navigation";
import { useRuntimeStore } from "@/stores/runtime";
import { useServicesStore } from "@/stores/services";
import { useStageStore } from "@/stores/stage";
import { useVideoQuickLaunchStore } from "@/stores/video-quick-launch";
import {
  GhostIconCamera,
  GhostIconCard,
  GhostIconMenu,
  GhostIconTarget,
  GhostIconWave,
} from "./ghost-icons";
import { NotificationBell } from "./NotificationBell";
import { SpaceSelector } from "./SpaceSelector";

/** Format yearMonth précédent (UTC) pour la Hearst Card du mois passé. */
function previousYearMonth(now: Date = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

interface ConnectionsMeta {
  connected: number;
  total: number;
}

interface AmbientSignal {
  id: string;
  kind: "mission_failed" | "oauth_expired" | "brief_stale" | "variant_timeout" | "mission_silent";
  narration: string;
  detectedAt: string;
  ctaHref?: string;
  severity: "info" | "warning";
}

/** Un signal détecté il y a > 30 min n'est plus rendu (whisper, pas alerte). */
const SIGNAL_TTL_MS = 30 * 60_000;
/** Crossfade entre signaux quand il y en a plusieurs. */
const SIGNAL_ROTATION_MS = 5_000;

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
  // Source : useServicesStore (hydraté par HomePageClient au mount, puis
  // refreshé ici toutes les 60s). On dérive `connected/total` depuis les
  // services au lieu de requérir un second fetch parallèle de
  // /api/v2/user/connections — économise ~1s au mount et un fetch toutes
  // les 60s.
  const services = useServicesStore((s) => s.services);
  const servicesLoaded = useServicesStore((s) => s.loaded);
  const setStoreServices = useServicesStore((s) => s.setServices);
  const setStoreLoaded = useServicesStore((s) => s.setLoaded);
  const connections = useMemo<ConnectionsMeta | null>(() => {
    if (!servicesLoaded) return null;
    const connected = services.filter((s) => s.connectionStatus === "connected").length;
    return { connected, total: services.length };
  }, [services, servicesLoaded]);
  useEffect(() => {
    let cancelled = false;
    async function refreshConnections() {
      try {
        const r = await fetch("/api/v2/user/connections", {
          cache: "no-store",
          credentials: "include",
        });
        if (!r.ok) return;
        const data = (await r.json()) as { services?: unknown };
        if (!cancelled && Array.isArray(data?.services)) {
          setStoreServices(data.services as Parameters<typeof setStoreServices>[0]);
          setStoreLoaded(true);
        }
      } catch {
        // Fail-soft : on garde l'ancienne valeur du store, jamais de crash.
      }
    }
    // Pas de premier fetch ici : HomePageClient hydrate déjà le store au
    // mount. On se contente du refresh périodique pour capter les nouvelles
    // connexions OAuth sans saturer le serveur.
    const interval = setInterval(refreshConnections, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [setStoreServices, setStoreLoaded]);

  // ── Anomaly Whisper — signaux ambient OS humain ──
  // Source : /api/v2/cockpit/signals. Refresh 60s. Filtrage côté client : on
  // drop les signaux détectés il y a > 30min (le whisper s'efface tout seul
  // si la condition tient toujours, le serveur le re-détectera au prochain tick).
  const [signals, setSignals] = useState<AmbientSignal[]>([]);
  useEffect(() => {
    let cancelled = false;
    async function refreshSignals() {
      try {
        const r = await fetch("/api/v2/cockpit/signals", { cache: "no-store" });
        if (!r.ok) return;
        const data = (await r.json()) as { signals?: AmbientSignal[] };
        if (!cancelled && Array.isArray(data?.signals)) {
          setSignals(data.signals);
        }
      } catch {
        // Fail-soft : silence radio, jamais de crash.
      }
    }
    refreshSignals();
    const interval = setInterval(refreshSignals, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Tick monotone pour invalider le filtre TTL et faire avancer la rotation.
  // On stocke le `now` côté state plutôt que d'appeler Date.now() pendant le
  // render (purety rule react-hooks/purity).
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [signalIndex, setSignalIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setNowMs(Date.now());
      setSignalIndex((i) => i + 1);
    }, SIGNAL_ROTATION_MS);
    return () => clearInterval(interval);
  }, []);

  const visibleSignals = useMemo(() => {
    return signals.filter((s) => {
      const detectedMs = Date.parse(s.detectedAt);
      if (Number.isNaN(detectedMs)) return false;
      return nowMs - detectedMs <= SIGNAL_TTL_MS;
    });
  }, [signals, nowMs]);

  // Modulo lazy à la lecture : pas besoin d'effect de reset, l'index "déborde"
  // simplement et est ramené dans la fenêtre via le modulo (length safe).
  const currentSignal =
    visibleSignals.length > 0 ? visibleSignals[signalIndex % visibleSignals.length] : null;

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
      {/* Gauche : hamburger mobile + SpaceSelector (foundation Q3-C, preview).
         Le selector vit ici dans la zone non saturée à gauche du Cmd+K — il
         reste visible mobile et desktop, c'est un signal d'identité du
         workspace (perso / side / venture) plus qu'un control fréquent. */}
      <div className="flex items-center" style={{ gap: "var(--space-3)" }}>
        <button
          type="button"
          onClick={toggleLeftDrawer}
          className="md:hidden w-7 h-7 flex items-center justify-center text-text-faint hover:text-(--accent-teal) transition-colors shrink-0"
          aria-label="Ouvrir les conversations"
        >
          <GhostIconMenu className="w-4 h-4" />
        </button>
        <SpaceSelector />
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
            padding: "var(--space-0-5) var(--space-1)",
            border: "1px solid var(--border-soft)",
            borderRadius: "var(--radius-xs)",
            letterSpacing: "var(--tracking-micro)",
          }}
        >
          ⌘K
        </span>
      </button>

      {/* Anomaly Whisper — slot ambient dédié.
         Pivot v1.6 (2026-05-10) : narration qualitative (mission failed,
         OAuth, brief stale, variant timeout, mission silencieuse). Voix
         sourde, point accent-teal — pas de rouge même pour severity warning,
         c'est un whisper, pas une alerte. Crossfade lent entre signaux
         quand il y en a plusieurs.
         Q3-B (2026-05-10) : ajout d'un mini-bouton "Voir tous" sur hover
         qui ouvre le SignalBoardStage en drill-down. Le clic principal
         garde le ctaHref direct — le bouton "Voir tous" est secondaire. */}
      {currentSignal && <AmbientWhisper key={currentSignal.id} signal={currentSignal} />}

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
              className="rounded-pill bg-(--accent-teal) halo-dot animate-pulse"
              style={{ width: "var(--space-2)", height: "var(--space-2)" }}
              aria-hidden
            />
            <span className="t-11 font-light text-(--accent-teal)">Voix</span>
          </div>
        )}

        {connections && (
          <a
            href="/connections"
            className="hidden md:flex items-center hover:opacity-80 transition-opacity"
            style={{ gap: "var(--space-2)" }}
            title={`${connections.connected}/${connections.total} services connectés — gérer dans /connections`}
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
            <span className="t-11 font-light text-text-faint">/ {connections.total} services</span>
          </a>
        )}

        {/* Discoverability quick-actions — entry points visibles pour les
           features hotkey-only (VideoQuickLaunch ⌘G, Focus ⌘⇧F, Signal Board,
           Hearst Card). Style sourd, icône seule + tooltip natif. */}
        <PulseBarQuickActions />

        <NotificationBell />
      </div>
    </div>
  );
}

/**
 * PulseBarQuickActions — rangée d'icônes pour les features cachées.
 *
 * Pivot 2026-05-10 : Adrien a remarqué que les nouvelles features
 * (VideoQuickLaunch, Mode Focus, Signal Board, Hearst Card) étaient
 * invisibles dans le cockpit (toutes conditionnelles ou hotkey-only).
 * Cette zone leur donne un entry point découvrable, cohérent avec le
 * pattern existant des autres icônes PulseBar (cloche, hamburger).
 *
 * Style : icônes 14×14 SVG, text-faint → hover accent-teal, gap space-3.
 * Pas de label texte — uniquement title pour tooltip natif. La carte
 * Hearst déclenche un POST best-effort vers /api/v2/hearst-card/[ym] et
 * ouvre le `publicShareUrl` retourné dans un nouvel onglet.
 */
function PulseBarQuickActions() {
  const openVideoLauncher = useVideoQuickLaunchStore((s) => s.openLauncher);
  const toggleFocus = useFocusMode((s) => s.toggle);
  const setMode = useStageStore((s) => s.setMode);
  const [hearstLoading, setHearstLoading] = useState(false);

  const onOpenSignalBoard = () => {
    setMode({ mode: "signal" });
  };

  const onOpenHearstCard = async () => {
    if (hearstLoading) return;
    setHearstLoading(true);
    try {
      const yearMonth = previousYearMonth();
      const r = await fetch(`/api/v2/hearst-card/${yearMonth}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!r.ok) return;
      const data = (await r.json()) as { publicShareUrl?: string };
      if (data?.publicShareUrl) {
        window.open(data.publicShareUrl, "_blank", "noopener,noreferrer");
      }
    } catch {
      // Fail-soft : pas de toast bruyant, l'user retentera.
    } finally {
      setHearstLoading(false);
    }
  };

  const buttonClass =
    "hidden md:flex w-7 h-7 items-center justify-center text-text-faint hover:text-(--accent-teal) transition-colors shrink-0 disabled:opacity-40";

  return (
    <div
      className="hidden md:flex items-center"
      style={{ gap: "var(--space-3)" }}
      data-testid="pulsebar-quick-actions"
    >
      <button
        type="button"
        onClick={openVideoLauncher}
        className={buttonClass}
        title="Générer une vidéo (⌘G)"
        aria-label="Générer une vidéo"
        data-testid="qa-video"
      >
        <GhostIconCamera className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={toggleFocus}
        className={buttonClass}
        title="Mode focus (⌘⇧F)"
        aria-label="Basculer le mode focus"
        data-testid="qa-focus"
      >
        <GhostIconTarget className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={onOpenSignalBoard}
        className={buttonClass}
        title="Tableau des signaux"
        aria-label="Ouvrir le tableau des signaux"
        data-testid="qa-signal"
      >
        <GhostIconWave className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={onOpenHearstCard}
        disabled={hearstLoading}
        className={buttonClass}
        title="Mon Wrapped du mois"
        aria-label="Ouvrir mon Wrapped mensuel"
        data-testid="qa-hearst-card"
      >
        <GhostIconCard className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

/**
 * AmbientWhisper — ligne ambient dans la PulseBar.
 *
 * Format : `⬤ [narration] →` cliquable. Style "silent luxury" : t-11
 * font-light, text-faint, point en var(--accent-teal) — pas de rouge même
 * pour severity warning. Crossfade opacity 0 → 1 sur var(--duration-slow)
 * pour un fondu doux à chaque changement de signal (la prop `key` du parent
 * remonte la rotation au remount).
 *
 * Q3-B : un bouton secondaire "Voir tous →" apparaît en hover (group-hover)
 * et ouvre le SignalBoardStage avec le signal pré-sélectionné.
 */
function AmbientWhisper({ signal }: { signal: AmbientSignal }) {
  const setMode = useStageStore((s) => s.setMode);
  const [visible, setVisible] = useState(false);

  // Fade-in au mount (visible: false → true au tick suivant pour déclencher la transition).
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const dotAndNarration = (
    <>
      <span
        className="rounded-pill shrink-0"
        style={{
          width: "var(--space-2)",
          height: "var(--space-2)",
          background: "var(--accent-teal)",
        }}
        aria-hidden
      />
      <span className="t-11 font-light truncate" style={{ color: "var(--text-faint)" }}>
        {signal.narration}
      </span>
      <span className="t-11 shrink-0" aria-hidden style={{ color: "var(--text-faint)" }}>
        →
      </span>
    </>
  );

  const onSeeAll = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMode({ mode: "signal", selectedSignalId: signal.id });
  };

  const groupClass = "hidden md:flex items-center min-w-0 max-w-sm group transition-opacity";
  const groupStyle: React.CSSProperties = {
    gap: "var(--space-2)",
    opacity: visible ? 1 : 0,
    transition: `opacity var(--duration-slow) var(--ease-standard)`,
  };

  const seeAllButton = (
    <button
      type="button"
      onClick={onSeeAll}
      className="t-9 font-light shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-(--accent-teal-border-hover)"
      style={{
        paddingLeft: "var(--space-2)",
        paddingRight: "var(--space-2)",
        paddingTop: "2px",
        paddingBottom: "2px",
        color: "var(--text-muted)",
        background: "transparent",
        border: "1px solid var(--border-soft)",
        borderRadius: "var(--radius-xs)",
        cursor: "pointer",
        transition:
          "opacity var(--duration-base) var(--ease-standard), color var(--duration-base) var(--ease-standard), border-color var(--duration-base) var(--ease-standard)",
      }}
      title="Voir tous les signaux"
      data-testid="ambient-whisper-see-all"
    >
      Voir tous
    </button>
  );

  if (signal.ctaHref) {
    return (
      <div
        className={groupClass}
        style={groupStyle}
        data-testid="ambient-whisper"
        data-signal-kind={signal.kind}
      >
        <a
          href={signal.ctaHref}
          className="flex items-center min-w-0 hover:opacity-100"
          style={{ gap: "var(--space-2)" }}
          title={signal.narration}
        >
          {dotAndNarration}
        </a>
        {seeAllButton}
      </div>
    );
  }

  return (
    <div
      className={groupClass}
      style={groupStyle}
      title={signal.narration}
      data-testid="ambient-whisper"
      data-signal-kind={signal.kind}
    >
      <div className="flex items-center min-w-0" style={{ gap: "var(--space-2)" }}>
        {dotAndNarration}
      </div>
      {seeAllButton}
    </div>
  );
}
