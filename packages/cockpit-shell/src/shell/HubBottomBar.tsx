"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  subscribe,
  getSnapshot,
  getServerSnapshot,
} from "../stores/activeProductStore";
import { useCockpit } from "./context";

/**
 * HubBottomBar — barre flottante en bas, visible uniquement sur le hub
 * (jamais en mode produit). Bouton Overview = retour au dashboard.
 */
export function HubBottomBar() {
  const active = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const { appId, getProduct } = useCockpit();
  const product = getProduct(appId);

  const [pathname, setPathname] = useState<string>("/");
  useEffect(() => {
    setPathname(window.location.pathname);
    const handler = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);

  if (active !== appId) return null;

  const onOverview = pathname === "/";

  return (
    <div className="ct-hub-bar">
      <span className="ct-hub-bar-label">
        <span
          className="ct-chat-ctx-dot"
          style={{ background: product.color }}
        />
        Cockpit
      </span>
      <div className="ct-hub-bar-track">
        <button
          type="button"
          className={`ct-hub-bar-seg${onOverview ? " active" : ""}`}
          onClick={() => {
            if (!onOverview) window.location.href = "/";
          }}
        >
          Overview
        </button>
      </div>
    </div>
  );
}
