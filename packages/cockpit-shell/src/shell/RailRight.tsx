"use client";

import { useSyncExternalStore } from "react";
import {
  subscribe,
  getSnapshot,
  getServerSnapshot,
  toggle,
} from "../stores/railOpenStore";
import {
  subscribe as subActive,
  getSnapshot as getActive,
  getServerSnapshot as getActiveSSR,
  setActive,
} from "../stores/activeProductStore";
import {
  subscribe as subView,
  getSnapshot as getView,
  getServerSnapshot as getViewSSR,
  setView,
} from "../stores/chatViewStore";
import { ChatKimi } from "../chat/ChatKimi";
import { ChatSettings } from "../chat/ChatSettings";
import { ChatHistory } from "../chat/ChatHistory";
import { useCockpit } from "./context";

const TITLES: Record<string, string> = {
  chat: "Assistant",
  settings: "Réglages",
  history: "Historique",
};

export function RailRight() {
  const open = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const active = useSyncExternalStore(subActive, getActive, getActiveSSR);
  const view = useSyncExternalStore(subView, getView, getViewSSR);
  const { appId, getProduct } = useCockpit();
  const product = getProduct(active);
  const inProduct = active !== appId;

  return (
    <aside className={`ct-rail-right${open ? "" : " collapsed"}`}>
      <div className="ct-rail-right-header">
        {open && (
          <span className="ct-rail-right-title">
            <span
              className="ct-chat-ctx-dot"
              style={{ background: product.color }}
            />
            {TITLES[view] ?? "Assistant"}
            <span className="ct-chat-ctx-name">· {product.name}</span>
          </span>
        )}
        {open && (
          <>
            <button
              className={`ct-rail-right-btn${view === "history" ? " active" : ""}`}
              onClick={() => setView(view === "history" ? "chat" : "history")}
              aria-label={view === "history" ? "Retour au chat" : "Historique"}
              title={view === "history" ? "Retour au chat" : "Historique"}
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.2" />
                <path d="M6.5 3.5V6.5L8.5 7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              className={`ct-rail-right-btn${view === "settings" ? " active" : ""}`}
              onClick={() => setView(view === "settings" ? "chat" : "settings")}
              aria-label={view === "settings" ? "Retour au chat" : "Paramètres"}
              title={view === "settings" ? "Retour au chat" : "Paramètres"}
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                <circle cx="6.5" cy="6.5" r="1.75" stroke="currentColor" strokeWidth="1.2" />
                <path d="M6.5 1v1.5M6.5 10.5V12M12 6.5h-1.5M2.5 6.5H1M10.3 2.7l-1.06 1.06M3.76 9.24l-1.06 1.06M10.3 10.3l-1.06-1.06M3.76 3.76 2.7 2.7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </button>
          </>
        )}
        <button
          className="ct-rail-right-btn"
          onClick={toggle}
          aria-label={open ? "Replier le chat" : "Déplier le chat"}
          title={open ? "Replier" : "Déplier"}
        >
          {open ? "›" : "‹"}
        </button>
      </div>
      <div className="ct-rail-right-body">
        {view === "settings" && <ChatSettings productName={product.name} productColor={product.color} />}
        {view === "history" && <ChatHistory productColor={product.color} />}
        {view === "chat" && <ChatKimi productName={product.name} productColor={product.color} />}
      </div>
    </aside>
  );
}
