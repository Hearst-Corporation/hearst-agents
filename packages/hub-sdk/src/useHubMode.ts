import { useSyncExternalStore } from "react";
import type { HearstHub, HubCapability } from "./types.js";

// ---------------------------------------------------------------------------
// HubModeSnapshot — snapshot de l'état hub du produit côté renderer.
// ---------------------------------------------------------------------------

interface HubModeSnapshot {
  isHub: boolean;
  ready: boolean;
  accent: string | undefined;
  productCtx: { id: string; name?: string; env: string } | null;
  cap: HubCapability[];
}

// SSR / standalone : état stable, zéro accès window.
const SERVER_SNAPSHOT: HubModeSnapshot = {
  isHub: false,
  ready: false,
  accent: undefined,
  productCtx: null,
  cap: [],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildCapabilities(): HubCapability[] {
  const cap: HubCapability[] = [];
  if (typeof window === "undefined" || !window.hearstHub) return cap;
  const hub = window.hearstHub as Partial<typeof window.hearstHub>;
  if (hub.storage) cap.push("storage");
  if (hub.files) cap.push("files");
  if (hub.secrets) cap.push("secrets");
  if (hub.openExternal) cap.push("openExternal");
  if (hub.notify) cap.push("notify");
  return cap;
}

function buildSnapshot(): HubModeSnapshot {
  if (typeof window === "undefined") return SERVER_SNAPSHOT;

  if (window.hearstHub) {
    // Défensif : le preload peut injecter { isHub: true } sans context complet
    // (ex: Earth Corporation qui expose uniquement window.hearstHub.isHub).
    const ctx = (window.hearstHub as unknown as { context?: HearstHub["context"] }).context;
    return {
      isHub: true,
      ready: true,
      accent: ctx?.accent,
      productCtx: ctx ? { id: ctx.productId, env: ctx.env } : null,
      cap: buildCapabilities(),
    };
  }

  // Fallback standalone : ?hub=1 ou sessionStorage
  let isHub = false;
  if (new URLSearchParams(location.search).get("hub") === "1") {
    isHub = true;
    try {
      sessionStorage.setItem("hearst:hub", "1");
    } catch {
      // sessionStorage indisponible (quota privé) — on ignore
    }
  } else if (sessionStorage.getItem("hearst:hub") === "1") {
    isHub = true;
  }

  return {
    isHub,
    ready: true,
    accent: undefined,
    productCtx: null,
    cap: [],
  };
}

// ---------------------------------------------------------------------------
// Mini-store useSyncExternalStore
//
// Invariant clé : getSnapshot() DOIT retourner la MÊME référence d'objet tant
// que le contexte hub n'a pas changé. Sinon useSyncExternalStore détecte une
// divergence à chaque appel et boucle en rendu infini.
//
// On mémoïse le snapshot courant et on ne le recrée QUE quand le contexte
// change (comparaison par valeur sur productId + accent + env + theme).
// ---------------------------------------------------------------------------

let _snapshot: HubModeSnapshot = SERVER_SNAPSHOT;
/**
 * Clé de comparaison du dernier contexte hub connu.
 * `null` = sentinelle d'init — jamais produite par `contextKey()` (qui retourne
 * toujours une string), donc la garde `key !== _ctxKey` est vraie au 1er appel
 * quel que soit le mode (standalone OU embarqué), y compris quand contextKey()
 * retourne "" (standalone sans window.hearstHub).
 */
let _ctxKey: string | null = null;

function contextKey(): string {
  if (typeof window === "undefined" || !window.hearstHub) return "";
  // Défensif : context peut être absent si le preload n'expose que isHub.
  const c = (window.hearstHub as unknown as { context?: HearstHub["context"] }).context;
  if (!c) return "hub-no-ctx";
  return `${c.productId}|${c.accent}|${c.env}|${c.theme}`;
}

/**
 * Recompute le snapshot si le contexte a changé depuis la dernière fois.
 * Retourne la même référence si rien n'a changé (stable pour useSyncExternalStore).
 */
function getSnapshot(): HubModeSnapshot {
  if (typeof window === "undefined") return SERVER_SNAPSHOT;
  const key = contextKey();
  if (key !== _ctxKey) {
    _ctxKey = key;
    _snapshot = buildSnapshot();
  }
  return _snapshot;
}

function getServerSnapshot(): HubModeSnapshot {
  return SERVER_SNAPSHOT;
}

// ---------------------------------------------------------------------------
// subscribe — s'abonne à window.hearstHub.onContext si disponible.
// En standalone (sans hearstHub), un polling borné tente de détecter une
// injection tardive du bridge (cas Electron : contextBridge peut arriver
// quelques ms après le montage du composant React).
// ---------------------------------------------------------------------------

const _listeners = new Set<() => void>();

/** Durée max du polling d'attente d'injection hub (ms). */
const HUB_POLL_TIMEOUT_MS = 3_000;
/** Intervalle de sondage (ms). */
const HUB_POLL_INTERVAL_MS = 50;

function _notify(): void {
  _ctxKey = null;
  _listeners.forEach((f) => f());
}

function subscribe(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  _listeners.add(cb);

  let unsubHub: (() => void) | undefined;
  let pollTimer: ReturnType<typeof setInterval> | undefined;
  let pollDeadline: ReturnType<typeof setTimeout> | undefined;

  if (window.hearstHub?.onContext) {
    // Hub déjà présent : abonnement direct.
    unsubHub = window.hearstHub.onContext(_notify);
  } else {
    // Polling borné : si le bridge est injecté APRÈS le montage (cas Electron
    // contextBridge asynchrone), on détecte sa présence en sondant
    // window.hearstHub toutes les HUB_POLL_INTERVAL_MS ms pendant au plus
    // HUB_POLL_TIMEOUT_MS ms. Dès détection, on arrête le poll et on
    // s'abonne proprement à onContext puis on force un re-render.
    pollTimer = setInterval(() => {
      if (window.hearstHub?.onContext) {
        clearInterval(pollTimer);
        clearTimeout(pollDeadline);
        pollTimer = undefined;
        pollDeadline = undefined;
        unsubHub = window.hearstHub.onContext(_notify);
        _notify();
      }
    }, HUB_POLL_INTERVAL_MS);

    pollDeadline = setTimeout(() => {
      clearInterval(pollTimer);
      pollTimer = undefined;
    }, HUB_POLL_TIMEOUT_MS);
  }

  return () => {
    _listeners.delete(cb);
    unsubHub?.();
    if (pollTimer !== undefined) clearInterval(pollTimer);
    if (pollDeadline !== undefined) clearTimeout(pollDeadline);
  };
}

// ---------------------------------------------------------------------------
// Public hook
// ---------------------------------------------------------------------------

export function useHubMode(): HubModeSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
