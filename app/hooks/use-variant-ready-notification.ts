"use client";

/**
 * useVariantReadyNotification — Notifications desktop (Web Notifications API)
 * pour signaler la fin d'une génération de variant (audio / vidéo / image / code).
 *
 * Stratégie :
 *  - Au mount, demande la permission `Notification` si pas encore décidé
 *    (état `default`). Pas de ré-prompt si l'user a déjà refusé (`denied`).
 *  - Expose `notify({ title, body, icon, onClick })` qui no-op gracieusement
 *    si l'API n'existe pas (SSR, navigateur ancien) ou si la permission est
 *    refusée.
 *  - Le clic sur la notification appelle `onClick` (typiquement `focus()` +
 *    setStageMode pour ramener l'user sur l'asset).
 *
 * Le hook est volontairement minimaliste : il ne tient pas l'état des
 * variants — c'est `AssetVariantTabs` qui détecte les transitions
 * `pending|generating → ready` et appelle `notify()`.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export type NotificationPermissionState = "default" | "granted" | "denied" | "unsupported";

interface NotifyOptions {
  title: string;
  body: string;
  icon?: string;
  /** Appelé au clic sur la notification (avant fermeture). */
  onClick?: () => void;
  /** Tag — permet de remplacer une notif existante au lieu d'empiler. */
  tag?: string;
}

export function useVariantReadyNotification(): {
  permission: NotificationPermissionState;
  notify: (options: NotifyOptions) => void;
  requestPermission: () => Promise<NotificationPermissionState>;
} {
  const [permission, setPermission] = useState<NotificationPermissionState>(() => {
    if (typeof window === "undefined" || typeof Notification === "undefined") {
      return "unsupported";
    }
    return Notification.permission as NotificationPermissionState;
  });

  // Évite les ré-prompts dans le même mount.
  const requestedRef = useRef(false);

  const requestPermission = useCallback(async (): Promise<NotificationPermissionState> => {
    if (typeof window === "undefined" || typeof Notification === "undefined") {
      return "unsupported";
    }
    if (Notification.permission !== "default") {
      const current = Notification.permission as NotificationPermissionState;
      setPermission(current);
      return current;
    }
    try {
      const result = await Notification.requestPermission();
      const next = result as NotificationPermissionState;
      setPermission(next);
      return next;
    } catch {
      return "denied";
    }
  }, []);

  // Demande automatique au mount, une seule fois.
  useEffect(() => {
    if (requestedRef.current) return;
    requestedRef.current = true;
    if (typeof window === "undefined" || typeof Notification === "undefined") return;
    if (Notification.permission === "default") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- requestPermission est async (await), setPermission n'est appelé qu'après la résolution de la promise navigateur (microtask)
      void requestPermission();
    }
  }, [requestPermission]);

  const notify = useCallback((options: NotifyOptions) => {
    if (typeof window === "undefined" || typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;

    try {
      const notif = new Notification(options.title, {
        body: options.body,
        icon: options.icon ?? "/hearst-logo.svg",
        tag: options.tag,
      });
      notif.onclick = () => {
        try {
          window.focus();
        } catch {
          // ignore — focus peut échouer en cross-origin / sans interaction
        }
        options.onClick?.();
        notif.close();
      };
    } catch (err) {
      // Certains navigateurs throw si la notif est invoquée hors d'un contexte
      // utilisateur (rare avec Notification API mais documenté). On no-op.
      console.warn("[useVariantReadyNotification] notify failed:", err);
    }
  }, []);

  return { permission, notify, requestPermission };
}
