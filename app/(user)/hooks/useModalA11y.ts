"use client";

/**
 * useModalA11y — hook centralisé d'accessibilité pour les modales / drawers.
 *
 * Couvre les 5 invariants WCAG AA pour un dialog :
 *   1. role="dialog" + aria-modal="true" (à appliquer manuellement sur le
 *      conteneur — le hook ne gère que la logique runtime).
 *   2. Focus trap : Tab et Shift+Tab cyclent à l'intérieur du conteneur.
 *      Aucun focus possible hors de la modale tant qu'elle est ouverte.
 *   3. Escape ferme la modale (handler keydown sur window, opt-out possible
 *      via `closeOnEscape: false` si une logique parent gère déjà la touche).
 *   4. Restore focus : sauvegarde `document.activeElement` à l'ouverture,
 *      restaure le focus dessus à la fermeture (ou unmount).
 *   5. Body scroll lock : `document.body.style.overflow = "hidden"` à
 *      l'ouverture, restauration de la valeur originale à la fermeture.
 *
 * Usage :
 *   const containerRef = useModalA11y(open, { onClose: () => setOpen(false) });
 *   return (
 *     <div ref={containerRef} role="dialog" aria-modal="true" aria-label="…">
 *       …
 *     </div>
 *   );
 *
 * Notes :
 *   - Si un autre handler a déjà géré Escape (ex: e.defaultPrevented), le
 *     hook ne déclenche pas onClose. Ça permet la coexistence avec des
 *     useEffect locaux qui ferment déjà sur Escape — pas de double-call.
 *   - Le focus initial est posé sur le premier élément focusable du
 *     conteneur (sauf si `autoFocus={false}`), permettant aux composants
 *     qui veulent gérer leur propre focus initial (ex: <input autoFocus />)
 *     de désactiver ce comportement.
 */

import { useEffect, useRef } from "react";

/** Sélecteur des éléments focusables — selon spec WAI-ARIA. */
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
  "[contenteditable='true']",
].join(",");

interface UseModalA11yOptions {
  /** Callback appelé sur Escape. Si non fourni, Escape est ignoré. */
  onClose?: () => void;
  /** Désactive le handler Escape interne (utile si parent gère déjà). */
  closeOnEscape?: boolean;
  /** Pose le focus sur le premier focusable au mount (default: true). */
  autoFocus?: boolean;
  /** Désactive le scroll lock (utile pour side panels non-bloquants). */
  lockBodyScroll?: boolean;
}

/**
 * Retourne une `RefObject` à attacher au conteneur de la modale.
 *
 * Le hook est no-op tant que `isOpen === false`.
 */
export function useModalA11y<T extends HTMLElement = HTMLDivElement>(
  isOpen: boolean,
  options: UseModalA11yOptions = {},
) {
  const {
    onClose,
    closeOnEscape = true,
    autoFocus = true,
    lockBodyScroll = true,
  } = options;
  const containerRef = useRef<T | null>(null);

  // ── Restore focus + scroll lock + Escape + focus trap ─────────────
  useEffect(() => {
    if (!isOpen) return;

    // 4. Save active element pour restore au close.
    const previousActive =
      typeof document !== "undefined" && document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    // 5. Body scroll lock.
    const originalOverflow = lockBodyScroll
      ? document.body.style.overflow
      : null;
    if (lockBodyScroll) {
      document.body.style.overflow = "hidden";
    }

    // Helper : récupère les focusables actuels du conteneur (re-query
    // à chaque Tab pour suivre les éléments montés/démontés dynamiquement).
    const getFocusables = (): HTMLElement[] => {
      const root = containerRef.current;
      if (!root) return [];
      return Array.from(
        root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter(
        (el) =>
          !el.hasAttribute("disabled") &&
          el.getAttribute("aria-hidden") !== "true" &&
          // Exclus les éléments visuellement cachés / hors flux.
          (el.offsetParent !== null || el === document.activeElement),
      );
    };

    // Initial focus : pose sur le premier focusable s'il n'y a pas déjà
    // un élément focalisé à l'intérieur du conteneur.
    if (autoFocus && containerRef.current) {
      const root = containerRef.current;
      const alreadyInside =
        document.activeElement && root.contains(document.activeElement);
      if (!alreadyInside) {
        const focusables = getFocusables();
        if (focusables.length > 0) {
          // Délai micro-tâche pour laisser React monter le DOM si le
          // hook est appelé dans le même cycle que le mount du conteneur.
          queueMicrotask(() => {
            const fresh = getFocusables();
            (fresh[0] ?? root).focus({ preventScroll: true });
          });
        } else {
          // Aucun focusable → focalise le conteneur lui-même (avec
          // tabindex=-1 implicite via focus programmatique).
          root.setAttribute("tabindex", "-1");
          root.focus({ preventScroll: true });
        }
      }
    }

    const handleKey = (e: KeyboardEvent) => {
      // 3. Escape ferme.
      if (e.key === "Escape" && closeOnEscape && onClose && !e.defaultPrevented) {
        e.preventDefault();
        onClose();
        return;
      }

      // 2. Focus trap sur Tab / Shift+Tab.
      if (e.key !== "Tab") return;
      const root = containerRef.current;
      if (!root) return;

      const focusables = getFocusables();
      if (focusables.length === 0) {
        // Aucun focusable → maintient le focus sur le conteneur.
        e.preventDefault();
        root.focus({ preventScroll: true });
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      const isInside = active ? root.contains(active) : false;

      if (e.shiftKey) {
        if (!isInside || active === first) {
          e.preventDefault();
          last.focus({ preventScroll: true });
        }
      } else {
        if (!isInside || active === last) {
          e.preventDefault();
          first.focus({ preventScroll: true });
        }
      }
    };

    window.addEventListener("keydown", handleKey);

    return () => {
      window.removeEventListener("keydown", handleKey);
      // 5. Restore body overflow.
      if (lockBodyScroll && originalOverflow !== null) {
        document.body.style.overflow = originalOverflow;
      }
      // 4. Restore focus sur l'élément précédent (si toujours dans le DOM).
      if (previousActive instanceof HTMLElement && document.contains(previousActive)) {
        try {
          previousActive.focus({ preventScroll: true });
        } catch {
          /* élément non focusable — ignore */
        }
      }
    };
  }, [isOpen, onClose, closeOnEscape, autoFocus, lockBodyScroll]);

  return containerRef;
}
