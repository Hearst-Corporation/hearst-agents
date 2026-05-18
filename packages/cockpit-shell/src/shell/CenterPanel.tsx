"use client";

import { useSyncExternalStore } from "react";
import {
  subscribe,
  getSnapshot,
  getServerSnapshot,
} from "../stores/activeProductStore";
import { useCockpit } from "./context";
import type { CenterPanelProps } from "./types";

/**
 * CenterPanel — zone centrale de l'app.
 *
 * Comportement par défaut (cas des 12 apps produit) :
 *   - rend `children` dans `.ct-page-area` (= la page courante de l'app).
 *
 * Comportement override (cas du hub agrégateur) :
 *   - si `renderProduct` est fourni : quand l'utilisateur sélectionne un
 *     autre produit que `appId` dans le rail gauche, on délègue à ce
 *     render-prop pour afficher le produit (webview Electron côté hub).
 *
 * Le shell reste donc générique : il ne sait pas embedder un produit, il
 * laisse le hub injecter sa logique d'embed.
 */
export function CenterPanel({ children, renderProduct }: CenterPanelProps) {
  const active = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const { appId } = useCockpit();

  const showProduct = renderProduct && active !== appId;

  return (
    <div className="ct-center-panel">
      {showProduct ? (
        renderProduct(active)
      ) : (
        <div className="ct-page-area">{children}</div>
      )}
    </div>
  );
}
