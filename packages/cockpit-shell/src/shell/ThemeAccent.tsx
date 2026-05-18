"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";
import {
  subscribe,
  getSnapshot,
  getServerSnapshot,
} from "../stores/activeProductStore";
import { useCockpit } from "./context";

/**
 * ThemeAccent — recolore tout le chrome Cockpit (chat, bottom bar, anneaux,
 * glow ambiant) à l'accent du produit actif. Pilote l'unique token
 * `--ct-accent` sur `:root` ; les autres accents en dérivent via `color-mix`.
 * `useLayoutEffect` (vs `useEffect`) pour appliquer la couleur avant peinture,
 * évitant le flash de la couleur précédente. Pas de rendu ; effet DOM only.
 */
export function ThemeAccent() {
  const active = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const { getProduct } = useCockpit();

  useLayoutEffect(() => {
    const { color } = getProduct(active);
    const root = document.documentElement;
    root.style.setProperty("--ct-accent", color);
    return () => {
      root.style.removeProperty("--ct-accent");
    };
  }, [active, getProduct]);

  return null;
}
