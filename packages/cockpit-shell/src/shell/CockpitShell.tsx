"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  subscribe,
  getSnapshot,
  getServerSnapshot,
  setDefaultActive,
  setActive,
} from "../stores/activeProductStore";
import { CockpitContext } from "./context";
import { RailLeft } from "./RailLeft";
import { CenterPanel } from "./CenterPanel";
import { RailRight } from "./RailRight";
import { ThemeAccent } from "./ThemeAccent";
import { HubBottomBar } from "./HubBottomBar";
import type { CockpitShellProps, CockpitProduct } from "./types";

/**
 * `<CockpitShell>` — point d'entrée unique.
 *
 * Enveloppe l'app : Rail gauche + centre + rail droit (chat Kimi). En mode
 * « immersif » (produit autre que `appId` actif) les rails du hub glissent
 * pour laisser le produit occuper l'écran (transition CSS).
 */
export function CockpitShell({
  children,
  products,
  appId,
  chatConfig,
  renderActiveProduct,
}: CockpitShellProps) {
  // Fixe le défaut du store actif sur l'appId courante (avant le 1er render).
  useEffect(() => {
    setDefaultActive(appId);
  }, [appId]);

  // Détecte Electron : la bande de glisse n'a de sens qu'en mode desktop.
  const [isElectron, setIsElectron] = useState(false);
  useEffect(() => {
    setIsElectron(
      typeof window !== "undefined" &&
      typeof (window as unknown as { electron?: unknown }).electron === "object",
    );
  }, []);

  const active = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Helper getProduct memoizé : O(1) si on construit une Map.
  const ctx = useMemo(() => {
    const map = new Map<string, CockpitProduct>();
    for (const p of products) map.set(p.id, p);
    const fallback: CockpitProduct = map.get(appId) ?? products[0] ?? {
      id: "hub",
      name: "Hearst Corporation",
      short: "HC",
      color: "#8A1538",
    };
    return {
      products,
      appId,
      chatConfig: chatConfig ?? {},
      getProduct: (id: string): CockpitProduct => map.get(id) ?? fallback,
    };
  }, [products, appId, chatConfig]);

  const inProduct = active !== appId;

  return (
    <CockpitContext.Provider value={ctx}>
      <div className={`ct-root${isElectron ? " ct-electron" : " ct-web"}`}>
        <ThemeAccent />
        {isElectron && <div className="ct-drag" />}
        <div className="ct-ambient-deep" />
        <div className="ct-ambient-glow" />
        <div className={`ct-panels-row${inProduct ? " ct-immersif" : ""}`}>
          <RailLeft />
          <CenterPanel {...(renderActiveProduct !== undefined ? { renderProduct: renderActiveProduct } : {})}>
            {children}
          </CenterPanel>
          <RailRight />
        </div>
        {inProduct && (
          <button
            type="button"
            className="ct-master-fab"
            onClick={() => setActive(appId)}
            title="Retour au hub Master"
          >
            Master
          </button>
        )}
        <HubBottomBar />
      </div>
    </CockpitContext.Provider>
  );
}
