"use client";

import { type ReactNode, useSyncExternalStore } from "react";
import {
  subscribe,
  getSnapshot,
  getServerSnapshot,
  setActive,
} from "../stores/activeProductStore";
import { useCockpit } from "./context";

type Segment = { label: string; href?: string; active?: boolean };
type Action = { label: string; onClick?: () => void; primary?: boolean };

interface BottomBarProps {
  label?: string;
  segments?: Segment[];
  actions?: Action[];
  children?: ReactNode;
}

function BottomBar({
  label = "● Cockpit",
  segments = [{ label: "Overview", href: "/", active: true }],
  actions = [],
  children,
}: BottomBarProps) {
  return (
    <div className="ct-bottom-bar">
      <div className="ct-bottom-bar-inner">
        {children ?? (
          <>
            <span className="ct-bottom-label">{label}</span>

            <div className="ct-seg-track">
              {segments.map((s) => (
                <a
                  key={s.label}
                  href={s.href ?? "#"}
                  className={`ct-seg-btn${s.active ? " active" : ""}`}
                >
                  {s.label}
                </a>
              ))}
            </div>

            {actions.length > 0 && (
              <div className="ct-seg-track">
                {actions.map((a) => (
                  <button
                    key={a.label}
                    className={`ct-seg-btn${a.primary ? " primary" : ""}`}
                    onClick={a.onClick}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Bottom bar contextualisée : reflète le produit actif (nom + accent).
 * Sur l'app hôte (appId), garde le libellé par défaut.
 * `bottomBar` : contenu contextuel injecté par l'app (ex. nav par page).
 */
export function ProductBottomBar({ bottomBar }: { bottomBar?: ReactNode }) {
  const active = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const { appId, getProduct } = useCockpit();
  const product = getProduct(active);

  if (product.id === appId) {
    return <BottomBar label={`● ${product.name}`}>{bottomBar}</BottomBar>;
  }

  return (
    <BottomBar
      label={`● ${product.name}`}
      segments={[{ label: "Produit", active: true }]}
      actions={[{ label: "← Retour", onClick: () => setActive(appId) }]}
    />
  );
}
