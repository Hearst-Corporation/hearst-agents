"use client";

import { useSyncExternalStore } from "react";
import {
  subscribe as subActive,
  getSnapshot as getActive,
  getServerSnapshot as getActiveSSR,
  setActive,
} from "../stores/activeProductStore";
import {
  subscribe as subLauncher,
  getSnapshot as getLauncher,
  getServerSnapshot as getLauncherSSR,
  set as setLauncher,
} from "../stores/launcherStore";
import { HearstMark } from "./HearstMark";
import { useCockpit } from "./context";

/**
 * Rail gauche — accordéon lanceur de la suite Hearst.
 *
 * - Lanceur OUVERT : rail élargi, tous les produits (hache + nom). Clic produit
 *   → on entre dans le produit, le lanceur se replie.
 * - Lanceur REPLIÉ : rail 88px, en haut le badge du produit actif (sa couleur,
 *   son nom) qui sert de toggle ; reclic → le lanceur se redéploie.
 */
export function RailLeft() {
  const { products, appId, getProduct } = useCockpit();
  const active = useSyncExternalStore(subActive, getActive, getActiveSSR);
  const open = useSyncExternalStore(subLauncher, getLauncher, getLauncherSSR);

  const otherProducts = products.filter((p) => p.id !== appId);
  const current = getProduct(active);
  const inProduct = current.id !== appId;

  const label = (name: string) => name.replace(/^Hearst\s+/, "");
  const top = inProduct && !open ? current : getProduct(appId);

  function pick(id: string) {
    setActive(id);
    setLauncher(false);
  }

  return (
    <aside className={`ct-rail-left${open ? " launcher" : ""}`}>
      <button
        type="button"
        className="ct-rail-top"
        title={open ? "Réduire" : `${top.name} — ouvrir le lanceur`}
        aria-label={open ? "Réduire le lanceur" : "Ouvrir le lanceur"}
        onClick={() => {
          if (inProduct && !open) {
            setActive(appId);
          } else {
            setLauncher(!open);
          }
        }}
        style={{ ["--p-color" as string]: top.color }}
      >
        <span className="ct-rail-top-badge">
          <HearstMark size={26} />
        </span>
        <span className="ct-rail-top-name">{label(top.name)}</span>
      </button>

      {open ? (
        <nav className="ct-rail-list" aria-label="Produits Hearst">
          {otherProducts.map((p) => {
            const on = active === p.id;
            return (
              <button
                key={p.id}
                type="button"
                className={`ct-rail-row${on ? " active" : ""}`}
                title={p.name}
                aria-pressed={on}
                onClick={() => pick(p.id)}
                style={{ ["--p-color" as string]: p.color }}
              >
                <span className="ct-rail-row-icon">
                  <HearstMark size={24} />
                </span>
                <span className="ct-rail-row-name">{label(p.name)}</span>
              </button>
            );
          })}
        </nav>
      ) : (
        <div className="ct-spacer" />
      )}

      <div className="ct-spacer" />
      <div className="ct-avatar" title={appId}>
        {(getProduct(appId).short || "HC").slice(0, 2).toUpperCase()}
      </div>
    </aside>
  );
}
